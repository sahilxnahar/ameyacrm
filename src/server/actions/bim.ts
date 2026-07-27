'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

function asDate(s?: string | null): Date | null { if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; }

export interface BimModelInput { projectId: string; name: string; urn?: string | null; discipline?: string | null; progressPct?: number }
export async function saveBimModel(input: BimModelInput, id?: string): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    await ensure('procurement.manage');
    if (!input.projectId || !input.name?.trim()) return { error: 'Project and model name are required.' };
    const data = { projectId: input.projectId, name: input.name.trim(), urn: input.urn?.trim() || null, discipline: input.discipline?.trim() || null, progressPct: input.progressPct != null && Number.isFinite(input.progressPct) ? Math.min(100, Math.max(0, input.progressPct)) : 0 };
    const row = id ? await prisma.bimModel.update({ where: { id }, data }) : await prisma.bimModel.create({ data });
    await writeAudit({ action: id ? 'UPDATE' : 'CREATE', entityType: 'BimModel', entityId: row.id, summary: `BIM model ${data.name} (${data.progressPct}%)` });
    revalidatePath('/bim-sync');
    return { ok: true, id: row.id };
  } catch (err) { return toActionError(err); }
}

export interface BimPhaseInput { bimModelId: string; label: string; plannedOn?: string | null; milestoneId?: string | null; triggersDemand?: boolean }
export async function saveBimPhase(input: BimPhaseInput): Promise<{ ok: true } | { error: string }> {
  try {
    await ensure('procurement.manage');
    if (!input.bimModelId || !input.label?.trim()) return { error: 'Model and phase label are required.' };
    await prisma.bimPhase.create({ data: { bimModelId: input.bimModelId, label: input.label.trim(), plannedOn: asDate(input.plannedOn), milestoneId: input.milestoneId || null, triggersDemand: input.triggersDemand ?? false } });
    revalidatePath('/bim-sync');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/**
 * Mark a phase physically complete. This is the 4D → cash-flow bridge: if the
 * phase is wired to trigger a demand and linked to a buyer PaymentMilestone, we
 * bring that milestone's due date to today so the existing dunning engine raises
 * the demand on its next run — a slab cast turns into a RERA-compliant demand.
 */
export async function completeBimPhase(id: string): Promise<{ ok: true; triggered: boolean } | { error: string }> {
  try {
    await ensure('procurement.manage');
    const phase = await prisma.bimPhase.findUnique({ where: { id }, select: { id: true, label: true, milestoneId: true, triggersDemand: true } });
    if (!phase) return { error: 'Phase not found.' };
    await prisma.bimPhase.update({ where: { id }, data: { actualOn: new Date() } });
    let triggered = false;
    if (phase.triggersDemand && phase.milestoneId) {
      // Only pull the due date forward if it's still pending and not already due.
      const ms = await prisma.paymentMilestone.findUnique({ where: { id: phase.milestoneId }, select: { status: true, dueDate: true } });
      if (ms && (ms.status === 'PENDING' || ms.status === 'PARTIAL')) {
        await prisma.paymentMilestone.update({ where: { id: phase.milestoneId }, data: { dueDate: new Date() } });
        triggered = true;
      }
    }
    await writeAudit({ action: 'UPDATE', entityType: 'BimPhase', entityId: id, summary: `Phase "${phase.label}" completed${triggered ? ' → demand triggered' : ''}` });
    revalidatePath('/bim-sync');
    return { ok: true, triggered };
  } catch (err) { return toActionError(err); }
}

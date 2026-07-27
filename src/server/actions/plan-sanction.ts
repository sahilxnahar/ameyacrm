'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { deviationPct } from '@/lib/planning/far';
import { ensure, toActionError } from './_helpers';

function asDate(s?: string | null): Date | null { if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; }
function num(n?: number | null): number { return n != null && Number.isFinite(n) ? n : 0; }

export interface PlanSanctionInput {
  projectId: string; sanctionNo?: string | null; authority?: string;
  sanctionedFar: number; builtFar?: number; sanctionedArea?: number | null; builtArea?: number | null;
  ocApplied?: boolean; ocReceived?: boolean; ocNumber?: string | null; sanctionedOn?: string | null;
}

export async function savePlanSanction(input: PlanSanctionInput, id?: string): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    await ensure('land.manage');
    if (!input.projectId) return { error: 'Project is required.' };
    if (!(num(input.sanctionedFar) > 0)) return { error: 'Sanctioned FAR must be greater than zero.' };
    const sanctionedFar = num(input.sanctionedFar);
    const builtFar = num(input.builtFar);
    const data = {
      projectId: input.projectId, sanctionNo: input.sanctionNo?.trim() || null, authority: (input.authority || 'BBMP').trim(),
      sanctionedFar, builtFar, sanctionedArea: input.sanctionedArea != null ? num(input.sanctionedArea) : null,
      builtArea: input.builtArea != null ? num(input.builtArea) : null, deviationPct: deviationPct(sanctionedFar, builtFar),
      ocApplied: input.ocApplied ?? false, ocReceived: input.ocReceived ?? false, ocNumber: input.ocNumber?.trim() || null,
      sanctionedOn: asDate(input.sanctionedOn),
    };
    const row = id ? await prisma.planSanction.update({ where: { id }, data }) : await prisma.planSanction.create({ data });
    await writeAudit({ action: id ? 'UPDATE' : 'CREATE', entityType: 'PlanSanction', entityId: row.id, summary: `${data.authority} sanction — FAR ${builtFar}/${sanctionedFar} (${data.deviationPct}% dev)` });
    revalidatePath('/plan-sanction');
    return { ok: true, id: row.id };
  } catch (err) { return toActionError(err); }
}

/** Quick as-built FAR update (the number that moves as construction proceeds). */
export async function updateBuiltFar(id: string, builtFar: number): Promise<{ ok: true } | { error: string }> {
  try {
    await ensure('land.manage');
    const row = await prisma.planSanction.findUnique({ where: { id }, select: { sanctionedFar: true } });
    if (!row) return { error: 'Sanction not found.' };
    await prisma.planSanction.update({ where: { id }, data: { builtFar: num(builtFar), deviationPct: deviationPct(Number(row.sanctionedFar), num(builtFar)) } });
    revalidatePath('/plan-sanction');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

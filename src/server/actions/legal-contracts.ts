'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

// ── Module 82: Structural contracts + engineer certifications ────────────────
const SC_STATUS = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED', 'CLOSED'] as const;
type ScStatus = (typeof SC_STATUS)[number];
function asScStatus(s?: string): ScStatus { return (SC_STATUS as readonly string[]).includes(s ?? '') ? (s as ScStatus) : 'DRAFT'; }
function asDate(s?: string | null): Date | null { if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; }

export interface StructuralContractInput {
  projectId: string; vendorId: string; title: string; contractNo: string;
  status?: string; liabilityClause?: string | null; defectLiabilityEnd?: string | null;
  startOn?: string | null; endOn?: string | null; value?: number | null;
}

export async function saveStructuralContract(input: StructuralContractInput, id?: string): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    await ensure('procurement.manage');
    if (!input.title?.trim() || !input.contractNo?.trim()) return { error: 'Title and contract number are required.' };
    if (!input.projectId || !input.vendorId) return { error: 'Project and vendor are required.' };
    const data = {
      projectId: input.projectId, vendorId: input.vendorId, title: input.title.trim(), contractNo: input.contractNo.trim(),
      status: asScStatus(input.status), liabilityClause: input.liabilityClause?.trim() || null,
      defectLiabilityEnd: asDate(input.defectLiabilityEnd), startOn: asDate(input.startOn), endOn: asDate(input.endOn),
      value: input.value != null && Number.isFinite(input.value) ? input.value : null,
    };
    const row = id
      ? await prisma.structuralContract.update({ where: { id }, data })
      : await prisma.structuralContract.create({ data });
    await writeAudit({ action: id ? 'UPDATE' : 'CREATE', entityType: 'StructuralContract', entityId: row.id, summary: `${id ? 'Updated' : 'Created'} structural contract ${data.contractNo}` });
    revalidatePath('/structural-contracts');
    return { ok: true, id: row.id };
  } catch (err) { return toActionError(err); }
}

export async function certifyEngineerPeriod(contractId: string, period: string, isCleared: boolean, remarks?: string): Promise<{ ok: true } | { error: string }> {
  try {
    const ctx = await ensure('procurement.manage');
    if (!/^\d{4}-\d{2}$/.test(period)) return { error: 'Period must be YYYY-MM.' };
    await prisma.engineerCertification.upsert({
      where: { contractId_period: { contractId, period } },
      update: { isCleared, remarks: remarks?.trim() || null, certifiedById: isCleared ? ctx.user.id : null, certifiedAt: isCleared ? new Date() : null },
      create: { contractId, vendorId: (await prisma.structuralContract.findUnique({ where: { id: contractId }, select: { vendorId: true } }))?.vendorId ?? '', period, isCleared, remarks: remarks?.trim() || null, certifiedById: isCleared ? ctx.user.id : null, certifiedAt: isCleared ? new Date() : null },
    });
    await writeAudit({ action: 'UPDATE', entityType: 'StructuralContract', entityId: contractId, summary: `IE certification ${period}: ${isCleared ? 'CLEARED' : 'held'}` });
    revalidatePath('/structural-contracts');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

// ── Module 87: Vendor insolvency cases ───────────────────────────────────────
const INS_STAGE = ['FLAGGED', 'CIRP_ADMITTED', 'MORATORIUM', 'RESOLUTION', 'LIQUIDATION', 'CLOSED'] as const;
type InsStage = (typeof INS_STAGE)[number];
function asInsStage(s?: string): InsStage { return (INS_STAGE as readonly string[]).includes(s ?? '') ? (s as InsStage) : 'FLAGGED'; }

export interface InsolvencyInput {
  vendorId: string; stage?: string; ncltBench?: string | null; cirpRef?: string | null;
  irpName?: string | null; admittedOn?: string | null; freezeAdvances?: boolean;
  claimFiledInr?: number | null; remarks?: string | null;
}

export async function saveInsolvencyCase(input: InsolvencyInput, id?: string): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    await ensure('finance.ledger.manage');
    if (!input.vendorId) return { error: 'Vendor is required.' };
    const data = {
      vendorId: input.vendorId, stage: asInsStage(input.stage), ncltBench: input.ncltBench?.trim() || null,
      cirpRef: input.cirpRef?.trim() || null, irpName: input.irpName?.trim() || null,
      admittedOn: asDate(input.admittedOn), freezeAdvances: input.freezeAdvances ?? true,
      claimFiledInr: input.claimFiledInr != null && Number.isFinite(input.claimFiledInr) ? input.claimFiledInr : null,
      remarks: input.remarks?.trim() || null,
    };
    const row = id
      ? await prisma.vendorInsolvencyCase.update({ where: { id }, data })
      : await prisma.vendorInsolvencyCase.create({ data });
    // Enforce the freeze immediately on save, not just at the daily sweep.
    if (['CIRP_ADMITTED', 'MORATORIUM'].includes(data.stage) && data.freezeAdvances) {
      await prisma.vendor.update({ where: { id: data.vendorId }, data: { isActive: false } }).catch(() => undefined);
    }
    await writeAudit({ action: id ? 'UPDATE' : 'CREATE', entityType: 'VendorInsolvencyCase', entityId: row.id, summary: `Insolvency ${data.stage} for vendor ${data.vendorId}` });
    revalidatePath('/vendor-insolvency');
    return { ok: true, id: row.id };
  } catch (err) { return toActionError(err); }
}

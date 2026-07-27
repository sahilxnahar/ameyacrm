'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

const RECORD_TYPES = ['RERA_CERTIFICATE', 'ENCUMBRANCE_CERTIFICATE', 'LAND_RECORD_ROR', 'COURT_CLEARANCE', 'TOWN_PLANNING_APPROVAL', 'MUNICIPAL_SANCTION', 'HILL_AREA_CLEARANCE', 'MASTER_PLAN_EXTRACT'] as const;
type RecordType = (typeof RECORD_TYPES)[number];
function asType(s?: string): RecordType { return (RECORD_TYPES as readonly string[]).includes(s ?? '') ? (s as RecordType) : 'RERA_CERTIFICATE'; }
function asDate(s?: string | null): Date | null { if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; }

export interface DueDiligenceInput {
  projectId: string; recordType: string; state: string; authorityName: string;
  region?: string | null; reference?: string | null; documentUrl?: string | null;
  validUntil?: string | null; note?: string | null;
}

export async function saveDueDiligenceRecord(input: DueDiligenceInput, id?: string): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    await ensure('land.manage');
    if (!input.projectId) return { error: 'Project is required.' };
    if (!input.state?.trim() || !input.authorityName?.trim()) return { error: 'State and authority are required.' };
    const data = {
      projectId: input.projectId, recordType: asType(input.recordType), state: input.state.trim(),
      region: input.region?.trim() || null, authorityName: input.authorityName.trim(),
      reference: input.reference?.trim() || null, documentUrl: input.documentUrl?.trim() || null,
      validUntil: asDate(input.validUntil), note: input.note?.trim() || null,
    };
    const row = id ? await prisma.dueDiligenceRecord.update({ where: { id }, data }) : await prisma.dueDiligenceRecord.create({ data });
    await writeAudit({ action: id ? 'UPDATE' : 'CREATE', entityType: 'DueDiligenceRecord', entityId: row.id, summary: `${data.recordType} from ${data.authorityName} (${data.state})` });
    revalidatePath('/due-diligence');
    return { ok: true, id: row.id };
  } catch (err) { return toActionError(err); }
}

export async function verifyDueDiligenceRecord(id: string, status: 'VERIFIED' | 'REJECTED' | 'PENDING'): Promise<{ ok: true } | { error: string }> {
  try {
    await ensure('land.manage');
    await prisma.dueDiligenceRecord.update({ where: { id }, data: { verificationStatus: status } });
    revalidatePath('/due-diligence');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function deleteDueDiligenceRecord(id: string): Promise<{ ok: true } | { error: string }> {
  try {
    await ensure('land.manage');
    await prisma.dueDiligenceRecord.delete({ where: { id } });
    revalidatePath('/due-diligence');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

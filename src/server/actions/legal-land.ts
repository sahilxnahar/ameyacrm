'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

function asDate(s?: string | null): Date | null { if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; }
function asInt(n?: number | string | null): number | null { const v = Number(n); return Number.isFinite(v) ? Math.trunc(v) : null; }

// ── Module 84: Title chain entries ───────────────────────────────────────────
const LINK_KINDS = ['MOTHER_DEED', 'SALE_DEED', 'GIFT_DEED', 'PARTITION_DEED', 'MUTATION_EXTRACT', 'ENCUMBRANCE_CERT', 'RTC_PAHANI', 'CONVERSION_ORDER', 'WILL', 'COURT_DECREE', 'OTHER'] as const;
type LinkKind = (typeof LINK_KINDS)[number];
function asKind(s?: string): LinkKind { return (LINK_KINDS as readonly string[]).includes(s ?? '') ? (s as LinkKind) : 'OTHER'; }

export interface TitleEntryInput {
  projectId?: string | null; kind?: string; fromParty?: string | null; toParty?: string | null;
  documentNo?: string | null; registeredOn?: string | null; sroOffice?: string | null;
  periodFrom?: number | null; periodTo?: number | null; remarks?: string | null;
}

export async function saveTitleEntry(input: TitleEntryInput, id?: string): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    await ensure('land.manage');
    const data = {
      projectId: input.projectId || null, kind: asKind(input.kind),
      fromParty: input.fromParty?.trim() || null, toParty: input.toParty?.trim() || null,
      documentNo: input.documentNo?.trim() || null, registeredOn: asDate(input.registeredOn),
      sroOffice: input.sroOffice?.trim() || null, periodFrom: asInt(input.periodFrom), periodTo: asInt(input.periodTo),
      remarks: input.remarks?.trim() || null,
    };
    const row = id ? await prisma.titleChainEntry.update({ where: { id }, data }) : await prisma.titleChainEntry.create({ data });
    await writeAudit({ action: id ? 'UPDATE' : 'CREATE', entityType: 'TitleChainEntry', entityId: row.id, summary: `${id ? 'Updated' : 'Added'} title-chain ${data.kind}` });
    revalidatePath('/title-vault');
    return { ok: true, id: row.id };
  } catch (err) { return toActionError(err); }
}

export async function verifyTitleEntry(id: string, verified: boolean): Promise<{ ok: true } | { error: string }> {
  try {
    await ensure('land.manage');
    await prisma.titleChainEntry.update({ where: { id }, data: { isVerified: verified } });
    revalidatePath('/title-vault');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

// ── Module 85: Landowners / heir tree ────────────────────────────────────────
export interface LandownerInput {
  projectId?: string | null; name: string; relationToRoot?: string | null; parentId?: string | null;
  isDeceased?: boolean; shareNum?: number | null; shareDen?: number | null;
  relinquished?: boolean; relinquishDeedNo?: string | null; relinquishOn?: string | null;
}

export async function saveLandowner(input: LandownerInput, id?: string): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    await ensure('land.manage');
    if (!input.name?.trim()) return { error: 'Name is required.' };
    const data = {
      projectId: input.projectId || null, name: input.name.trim(), relationToRoot: input.relationToRoot?.trim() || null,
      parentId: input.parentId || null, isDeceased: input.isDeceased ?? false,
      shareNum: asInt(input.shareNum), shareDen: asInt(input.shareDen),
      relinquished: input.relinquished ?? false, relinquishDeedNo: input.relinquishDeedNo?.trim() || null,
      relinquishOn: asDate(input.relinquishOn),
    };
    const row = id ? await prisma.landowner.update({ where: { id }, data }) : await prisma.landowner.create({ data });
    await writeAudit({ action: id ? 'UPDATE' : 'CREATE', entityType: 'Landowner', entityId: row.id, summary: `${id ? 'Updated' : 'Added'} landowner ${data.name}` });
    revalidatePath('/heir-mapper');
    return { ok: true, id: row.id };
  } catch (err) { return toActionError(err); }
}

// ── Module 88: Land conversion ───────────────────────────────────────────────
const CONV_STAGES = ['APPLIED', 'RTC_VERIFIED', 'DC_SCRUTINY', 'FEE_DEMANDED', 'FEE_PAID', 'DC_ORDER_ISSUED', 'KHATA_UPDATED', 'REJECTED'] as const;
type ConvStage = (typeof CONV_STAGES)[number];
function asStage(s?: string): ConvStage { return (CONV_STAGES as readonly string[]).includes(s ?? '') ? (s as ConvStage) : 'APPLIED'; }

export interface LandConversionInput {
  projectId?: string | null; surveyNo: string; village?: string | null; taluk?: string | null;
  extentAcres?: number | null; stage?: string; dcOrderNo?: string | null;
  conversionFee?: number | null; appliedOn?: string | null; orderOn?: string | null;
}

export async function saveLandConversion(input: LandConversionInput, id?: string): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    await ensure('land.manage');
    if (!input.surveyNo?.trim()) return { error: 'Survey number is required.' };
    const data = {
      projectId: input.projectId || null, surveyNo: input.surveyNo.trim(), village: input.village?.trim() || null,
      taluk: input.taluk?.trim() || null, extentAcres: input.extentAcres != null && Number.isFinite(input.extentAcres) ? input.extentAcres : null,
      stage: asStage(input.stage), dcOrderNo: input.dcOrderNo?.trim() || null,
      conversionFee: input.conversionFee != null && Number.isFinite(input.conversionFee) ? input.conversionFee : null,
      appliedOn: asDate(input.appliedOn), orderOn: asDate(input.orderOn),
    };
    const row = id ? await prisma.landConversion.update({ where: { id }, data }) : await prisma.landConversion.create({ data });
    await writeAudit({ action: id ? 'UPDATE' : 'CREATE', entityType: 'LandConversion', entityId: row.id, summary: `${id ? 'Updated' : 'Added'} land conversion ${data.surveyNo} (${data.stage})` });
    revalidatePath('/land-conversion');
    return { ok: true, id: row.id };
  } catch (err) { return toActionError(err); }
}

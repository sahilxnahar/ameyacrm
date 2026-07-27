'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

function asDate(s?: string | null): Date | null { if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; }
function num(n?: number | null): number | null { return n != null && Number.isFinite(n) ? n : null; }

// ── Module 83: NRI compliance + foreign remittance ───────────────────────────
const NRI_STATUS = ['PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED'] as const;
type NriStatus = (typeof NRI_STATUS)[number];
function asNriStatus(s?: string): NriStatus { return (NRI_STATUS as readonly string[]).includes(s ?? '') ? (s as NriStatus) : 'PENDING'; }

export interface NriProfileInput {
  bookingId?: string | null; leadId?: string | null; taxResidency: string; fatcaDeclared?: boolean;
  fatcaFormRef?: string | null; femaCategory?: string | null; overseasAddress?: string | null; status?: string;
}

export async function saveNriProfile(input: NriProfileInput, id?: string): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    await ensure('booking.manage');
    if (!input.taxResidency?.trim()) return { error: 'Tax residency is required.' };
    const status = asNriStatus(input.status);
    const data = {
      bookingId: input.bookingId || null, leadId: input.leadId || null, taxResidency: input.taxResidency.trim(),
      fatcaDeclared: input.fatcaDeclared ?? false, fatcaFormRef: input.fatcaFormRef?.trim() || null,
      femaCategory: input.femaCategory?.trim() || null, overseasAddress: input.overseasAddress?.trim() || null,
      status, verifiedAt: status === 'VERIFIED' ? new Date() : null,
    };
    const row = id ? await prisma.nriComplianceProfile.update({ where: { id }, data }) : await prisma.nriComplianceProfile.create({ data });
    await writeAudit({ action: id ? 'UPDATE' : 'CREATE', entityType: 'NriComplianceProfile', entityId: row.id, summary: `NRI KYC ${status} (${data.taxResidency})` });
    revalidatePath('/nri-gateway');
    return { ok: true, id: row.id };
  } catch (err) { return toActionError(err); }
}

export async function addForeignRemittance(profileId: string, amountForeign: number, currency: string, amountInr: number, receivedOn?: string | null, fireReference?: string | null): Promise<{ ok: true } | { error: string }> {
  try {
    await ensure('booking.manage');
    const recv = asDate(receivedOn) ?? new Date();
    const reportDueOn = new Date(recv.getTime() + 90 * 864e5); // FEMA: report within 90 days
    await prisma.foreignRemittance.create({
      data: { profileId, amountForeign: num(amountForeign) ?? 0, currency: currency.trim().toUpperCase().slice(0, 3), amountInr: num(amountInr) ?? 0, receivedOn: recv, reportDueOn, fireReference: fireReference?.trim() || null },
    });
    revalidatePath('/nri-gateway');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

// ── Module 86: ADR / arbitration ─────────────────────────────────────────────
const ADR_STAGES = ['NOTICE_ISSUED', 'CONCILIATION', 'ARBITRATOR_APPOINTED', 'PLEADINGS', 'HEARINGS', 'AWARD', 'SETTLED', 'CHALLENGED', 'CLOSED'] as const;
type AdrStage = (typeof ADR_STAGES)[number];
function asAdrStage(s?: string): AdrStage { return (ADR_STAGES as readonly string[]).includes(s ?? '') ? (s as AdrStage) : 'NOTICE_ISSUED'; }

export interface AdrInput {
  title: string; refNo: string; claimant: string; respondent: string; stage?: string;
  projectId?: string | null; vendorId?: string | null; arbitrator?: string | null;
  claimAmount?: number | null; nextHearingOn?: string | null;
}

export async function saveAdrCase(input: AdrInput, id?: string): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    await ensure('land.manage');
    if (!input.title?.trim() || !input.refNo?.trim()) return { error: 'Title and reference number are required.' };
    if (!input.claimant?.trim() || !input.respondent?.trim()) return { error: 'Claimant and respondent are required.' };
    const data = {
      title: input.title.trim(), refNo: input.refNo.trim(), claimant: input.claimant.trim(), respondent: input.respondent.trim(),
      stage: asAdrStage(input.stage), projectId: input.projectId || null, vendorId: input.vendorId || null,
      arbitrator: input.arbitrator?.trim() || null, claimAmount: num(input.claimAmount), nextHearingOn: asDate(input.nextHearingOn),
    };
    const row = id ? await prisma.adrCase.update({ where: { id }, data }) : await prisma.adrCase.create({ data });
    await writeAudit({ action: id ? 'UPDATE' : 'CREATE', entityType: 'AdrCase', entityId: row.id, summary: `ADR ${data.refNo} — ${data.stage}` });
    revalidatePath('/arbitration');
    return { ok: true, id: row.id };
  } catch (err) { return toActionError(err); }
}

// ── Module 89: e-Stamp ───────────────────────────────────────────────────────
export interface EstampInput {
  purpose: string; dutyInr: number; considerationInr?: number | null;
  bookingId?: string | null; projectId?: string | null; firstParty?: string | null; secondParty?: string | null;
}

export async function saveEstamp(input: EstampInput, id?: string): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    await ensure('booking.manage');
    if (!input.purpose?.trim()) return { error: 'Purpose is required.' };
    const data = {
      purpose: input.purpose.trim(), dutyInr: num(input.dutyInr) ?? 0, considerationInr: num(input.considerationInr),
      bookingId: input.bookingId || null, projectId: input.projectId || null,
      firstParty: input.firstParty?.trim() || null, secondParty: input.secondParty?.trim() || null,
    };
    const row = id ? await prisma.estampCertificate.update({ where: { id }, data }) : await prisma.estampCertificate.create({ data });
    await writeAudit({ action: id ? 'UPDATE' : 'CREATE', entityType: 'EstampCertificate', entityId: row.id, summary: `e-Stamp ${data.purpose} — duty ₹${data.dutyInr}` });
    revalidatePath('/estamps');
    return { ok: true, id: row.id };
  } catch (err) { return toActionError(err); }
}

// ── Module 90: REAT / High Court escalation ──────────────────────────────────
const LIT_FORUMS = ['RERA_AUTHORITY', 'REAT', 'HIGH_COURT', 'SUPREME_COURT'] as const;
const LIT_STATUS = ['FILED', 'ADMITTED', 'INTERIM_ORDER', 'ARGUMENTS', 'RESERVED', 'DISPOSED', 'APPEALED'] as const;
type LitForum = (typeof LIT_FORUMS)[number];
type LitStatus = (typeof LIT_STATUS)[number];
function asForum(s?: string): LitForum { return (LIT_FORUMS as readonly string[]).includes(s ?? '') ? (s as LitForum) : 'REAT'; }
function asLitStatus(s?: string): LitStatus { return (LIT_STATUS as readonly string[]).includes(s ?? '') ? (s as LitStatus) : 'FILED'; }

export interface LitigationInput {
  title: string; forum?: string; status?: string; caseNo?: string | null;
  projectId?: string | null; counselName?: string | null; interimOrder?: string | null;
  reliefSought?: string | null; disputedInr?: number | null; nextHearingOn?: string | null; filedOn?: string | null;
}

export async function saveLitigation(input: LitigationInput, id?: string): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    await ensure('land.manage');
    if (!input.title?.trim()) return { error: 'Title is required.' };
    const data = {
      title: input.title.trim(), forum: asForum(input.forum), status: asLitStatus(input.status), caseNo: input.caseNo?.trim() || null,
      projectId: input.projectId || null, counselName: input.counselName?.trim() || null,
      counselAssignedOn: input.counselName?.trim() ? new Date() : null,
      interimOrder: input.interimOrder?.trim() || null, reliefSought: input.reliefSought?.trim() || null,
      disputedInr: num(input.disputedInr), nextHearingOn: asDate(input.nextHearingOn), filedOn: asDate(input.filedOn),
    };
    const row = id ? await prisma.litigationEscalation.update({ where: { id }, data }) : await prisma.litigationEscalation.create({ data });
    await writeAudit({ action: id ? 'UPDATE' : 'CREATE', entityType: 'LitigationEscalation', entityId: row.id, summary: `${data.forum} — ${data.title} (${data.status})` });
    revalidatePath('/appellate-litigation');
    return { ok: true, id: row.id };
  } catch (err) { return toActionError(err); }
}

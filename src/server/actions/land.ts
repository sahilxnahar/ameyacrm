'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type LandResult = { ok: true; message: string; id?: string } | { error: string };

const optDate = (v?: string | null) => (v ? new Date(v) : null);

// ── Parcels ──────────────────────────────────────────────────────────────────
const parcelSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().optional().nullable(),
  name: z.string().min(2, 'Give the parcel a name.').max(160),
  surveyNumber: z.string().max(120).optional().nullable(),
  village: z.string().max(120).optional().nullable(),
  taluk: z.string().max(120).optional().nullable(),
  district: z.string().max(120).optional().nullable(),
  state: z.string().max(80).optional(),
  extentAcre: z.number().nonnegative().optional().nullable(),
  ownerName: z.string().max(200).optional().nullable(),
  askingRate: z.number().nonnegative().optional().nullable(),
  agreedRate: z.number().nonnegative().optional().nullable(),
  stage: z.enum(['IDENTIFIED', 'UNDER_NEGOTIATION', 'AGREED', 'DUE_DILIGENCE', 'REGISTERED', 'DROPPED']).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function saveParcel(input: unknown): Promise<LandResult> {
  try {
    const ctx = await ensure('land.manage');
    const d = parcelSchema.parse(input);
    const data = {
      projectId: d.projectId ?? null,
      name: d.name,
      surveyNumber: d.surveyNumber ?? null,
      village: d.village ?? null,
      taluk: d.taluk ?? null,
      district: d.district ?? null,
      state: d.state ?? 'Karnataka',
      extentAcre: d.extentAcre ?? null,
      ownerName: d.ownerName ?? null,
      askingRate: d.askingRate ?? null,
      agreedRate: d.agreedRate ?? null,
      stage: d.stage ?? 'IDENTIFIED',
      notes: d.notes ?? null,
    };
    const saved = d.id
      ? await prisma.landParcel.update({ where: { id: d.id }, data, select: { id: true } })
      : await prisma.landParcel.create({ data: { ...data, createdById: ctx.user.id }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: d.id ? 'UPDATE' : 'CREATE', entityType: 'LandParcel', entityId: saved.id, summary: `Parcel "${d.name}" (${data.stage})` });
    revalidatePath('/land');
    return { ok: true, message: d.id ? 'Parcel updated.' : 'Parcel added.', id: saved.id };
  } catch (e) {
    return toActionError(e);
  }
}

// ── Title documents ──────────────────────────────────────────────────────────
const titleSchema = z.object({
  id: z.string().optional(),
  parcelId: z.string().min(1),
  kind: z.enum(['MOTHER_DEED', 'SALE_DEED', 'GIFT_DEED', 'PARTITION_DEED', 'ENCUMBRANCE_CERTIFICATE', 'KHATA', 'CONVERSION_ORDER', 'POWER_OF_ATTORNEY', 'COURT_ORDER', 'OTHER']),
  title: z.string().min(2).max(200),
  chainOrder: z.number().int().min(0).max(9999),
  fromParty: z.string().max(200).optional().nullable(),
  toParty: z.string().max(200).optional().nullable(),
  documentDate: z.string().optional().nullable(),
  registrationNo: z.string().max(120).optional().nullable(),
  verified: z.boolean().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function saveTitleDocument(input: unknown): Promise<LandResult> {
  try {
    const ctx = await ensure('land.manage');
    const d = titleSchema.parse(input);
    const data = {
      parcelId: d.parcelId,
      kind: d.kind,
      title: d.title,
      chainOrder: d.chainOrder,
      fromParty: d.fromParty ?? null,
      toParty: d.toParty ?? null,
      documentDate: optDate(d.documentDate),
      registrationNo: d.registrationNo ?? null,
      verified: d.verified ?? false,
      notes: d.notes ?? null,
    };
    const saved = d.id
      ? await prisma.titleDocument.update({ where: { id: d.id }, data, select: { id: true } })
      : await prisma.titleDocument.create({ data, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: d.id ? 'UPDATE' : 'CREATE', entityType: 'TitleDocument', entityId: saved.id, summary: `Title link "${d.title}" (order ${d.chainOrder})` });
    revalidatePath('/land');
    return { ok: true, message: 'Title link saved.', id: saved.id };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setTitleVerified(id: string, verified: boolean): Promise<LandResult> {
  try {
    const ctx = await ensure('land.manage');
    await prisma.titleDocument.update({ where: { id }, data: { verified } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'TitleDocument', entityId: id, summary: verified ? 'Title link verified' : 'Title link marked unverified' });
    revalidatePath('/land');
    return { ok: true, message: verified ? 'Marked verified.' : 'Marked unverified.' };
  } catch (e) {
    return toActionError(e);
  }
}

// ── Approvals / sanctions ────────────────────────────────────────────────────
const approvalSchema = z.object({
  id: z.string().optional(),
  parcelId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  authority: z.string().min(1, 'Which authority?').max(120),
  name: z.string().min(2, 'What is the approval?').max(160),
  status: z.enum(['NOT_STARTED', 'APPLIED', 'IN_PROCESS', 'QUERY_RAISED', 'APPROVED', 'REJECTED', 'EXPIRED']),
  appliedOn: z.string().optional().nullable(),
  expectedOn: z.string().optional().nullable(),
  approvedOn: z.string().optional().nullable(),
  expiresOn: z.string().optional().nullable(),
  feePaid: z.number().nonnegative().optional().nullable(),
  currentDesk: z.string().max(160).optional().nullable(),
  referenceNo: z.string().max(120).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function saveApproval(input: unknown): Promise<LandResult> {
  try {
    const ctx = await ensure('land.manage');
    const d = approvalSchema.parse(input);
    const data = {
      parcelId: d.parcelId ?? null,
      projectId: d.projectId ?? null,
      authority: d.authority,
      name: d.name,
      status: d.status,
      appliedOn: optDate(d.appliedOn),
      expectedOn: optDate(d.expectedOn),
      approvedOn: optDate(d.approvedOn),
      expiresOn: optDate(d.expiresOn),
      feePaid: d.feePaid ?? null,
      currentDesk: d.currentDesk ?? null,
      referenceNo: d.referenceNo ?? null,
      notes: d.notes ?? null,
    };
    const saved = d.id
      ? await prisma.approvalSanction.update({ where: { id: d.id }, data, select: { id: true } })
      : await prisma.approvalSanction.create({ data: { ...data, createdById: ctx.user.id }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: d.id ? 'UPDATE' : 'CREATE', entityType: 'ApprovalSanction', entityId: saved.id, summary: `${d.authority} — ${d.name} (${d.status})` });
    revalidatePath('/land');
    return { ok: true, message: 'Approval saved.', id: saved.id };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addLiaisonLog(input: unknown): Promise<LandResult> {
  try {
    const ctx = await ensure('land.manage');
    const d = z.object({
      approvalId: z.string().min(1),
      note: z.string().min(3, 'Say what happened.').max(1000),
      chasedBy: z.string().max(160).optional().nullable(),
      metWith: z.string().max(160).optional().nullable(),
    }).parse(input);
    await prisma.liaisonLog.create({
      data: { approvalId: d.approvalId, note: d.note.trim(), chasedBy: d.chasedBy ?? ctx.user.name ?? null, metWith: d.metWith ?? null },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'ApprovalSanction', entityId: d.approvalId, summary: `Liaison: ${d.note.trim().slice(0, 120)}` });
    revalidatePath('/land');
    return { ok: true, message: 'Liaison note added.' };
  } catch (e) {
    return toActionError(e);
  }
}

// ── Litigation ───────────────────────────────────────────────────────────────
const litigationSchema = z.object({
  id: z.string().optional(),
  parcelId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  title: z.string().min(2, 'Name the matter.').max(200),
  court: z.string().max(160).optional().nullable(),
  caseNumber: z.string().max(120).optional().nullable(),
  counsel: z.string().max(160).optional().nullable(),
  status: z.enum(['OPEN', 'HEARING', 'RESERVED', 'DISPOSED', 'APPEAL', 'CLOSED']),
  nextHearing: z.string().optional().nullable(),
  exposure: z.number().nonnegative().optional().nullable(),
  summary: z.string().max(2000).optional().nullable(),
});

export async function saveLitigation(input: unknown): Promise<LandResult> {
  try {
    const ctx = await ensure('land.manage');
    const d = litigationSchema.parse(input);
    const data = {
      parcelId: d.parcelId ?? null,
      projectId: d.projectId ?? null,
      title: d.title,
      court: d.court ?? null,
      caseNumber: d.caseNumber ?? null,
      counsel: d.counsel ?? null,
      status: d.status,
      nextHearing: optDate(d.nextHearing),
      exposure: d.exposure ?? null,
      summary: d.summary ?? null,
    };
    const saved = d.id
      ? await prisma.litigationMatter.update({ where: { id: d.id }, data, select: { id: true } })
      : await prisma.litigationMatter.create({ data: { ...data, createdById: ctx.user.id }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: d.id ? 'UPDATE' : 'CREATE', entityType: 'LitigationMatter', entityId: saved.id, summary: `Matter "${d.title}" (${d.status})` });
    revalidatePath('/land');
    return { ok: true, message: 'Matter saved.', id: saved.id };
  } catch (e) {
    return toActionError(e);
  }
}

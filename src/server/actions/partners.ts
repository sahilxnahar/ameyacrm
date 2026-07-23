'use server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { nextReference } from '@/lib/utils/reference';
import { ensure, toActionError } from './_helpers';

export type PartnerResult = { ok: true; id?: string } | { error: string };

/** Create (or rotate) the channel partner's self-service portal link. */
export async function regenCpPortalToken(id: string): Promise<{ ok: true; token: string } | { error: string }> {
  try {
    const ctx = await ensure('booking.manage');
    const token = randomBytes(20).toString('hex');
    await prisma.channelPartner.update({ where: { id }, data: { portalToken: token } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'ChannelPartner', entityId: id, summary: 'Generated CP portal link' });
    revalidatePath('/partners');
    return { ok: true, token };
  } catch (err) { const e = toActionError(err); return e; }
}

const cpSchema = z.object({
  firmName: z.string().min(2).max(160),
  contactName: z.string().min(2).max(120),
  phone: z.string().min(5).max(30),
  email: z.string().email().optional().or(z.literal('')),
  reraNumber: z.string().max(60).optional(),
  panNumber: z.string().max(20).optional(),
  gstin: z.string().max(30).optional(),
  commissionPct: z.coerce.number().min(0).max(50).default(2),
  bankDetails: z.string().max(300).optional(),
  notes: z.string().max(500).optional(),
});
export async function createChannelPartner(input: unknown): Promise<PartnerResult> {
  try {
    const ctx = await ensure('booking.manage');
    const d = cpSchema.parse(input);
    const code = `CP-${1000 + (await prisma.channelPartner.count()) + 1}`;
    const cp = await prisma.channelPartner.create({
      data: {
        code, firmName: d.firmName, contactName: d.contactName, phone: d.phone, email: d.email || null,
        reraNumber: d.reraNumber || null, panNumber: d.panNumber || null, gstin: d.gstin || null,
        commissionPct: d.commissionPct, bankDetails: d.bankDetails || null, notes: d.notes || null, onboardedById: ctx.user.id,
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'ChannelPartner', entityId: cp.id, summary: `Onboarded CP ${d.firmName} (${code})` });
    revalidatePath('/partners');
    return { ok: true, id: cp.id };
  } catch (err) { return toActionError(err); }
}

export async function setPartnerStatus(id: string, status: 'PENDING' | 'APPROVED' | 'SUSPENDED'): Promise<PartnerResult> {
  try {
    const ctx = await ensure('booking.manage');
    await prisma.channelPartner.update({ where: { id }, data: { status } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'ChannelPartner', entityId: id, summary: `CP status → ${status}` });
    revalidatePath('/partners'); return { ok: true };
  } catch (err) { return toActionError(err); }
}
export async function setPartnerKyc(id: string, kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'): Promise<PartnerResult> {
  try {
    const ctx = await ensure('booking.manage');
    await prisma.channelPartner.update({ where: { id }, data: { kycStatus } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'ChannelPartner', entityId: id, summary: `CP KYC → ${kycStatus}` });
    revalidatePath('/partners'); return { ok: true };
  } catch (err) { return toActionError(err); }
}

const payoutSchema = z.object({
  channelPartnerId: z.string().min(1),
  grossValue: z.coerce.number().nonnegative(),
  ratePercent: z.coerce.number().min(0).max(50),
  stage: z.string().max(60).optional(),
  dueDate: z.string().optional().nullable(),
});
export async function addBrokeragePayout(input: unknown): Promise<PartnerResult> {
  try {
    const ctx = await ensure('booking.manage');
    const d = payoutSchema.parse(input);
    const amount = d.grossValue * (d.ratePercent / 100);
    const p = await prisma.brokeragePayout.create({
      data: { channelPartnerId: d.channelPartnerId, grossValue: d.grossValue, ratePercent: d.ratePercent, amount, stage: d.stage || null, dueDate: d.dueDate ? new Date(d.dueDate) : null, createdById: ctx.user.id },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'BrokeragePayout', entityId: p.id, summary: `Brokerage Rs.${amount.toFixed(0)}` });
    revalidatePath('/partners'); return { ok: true, id: p.id };
  } catch (err) { return toActionError(err); }
}
export async function setPayoutStatus(id: string, status: 'PENDING' | 'INVOICED' | 'PAID'): Promise<PartnerResult> {
  try {
    const ctx = await ensure('booking.manage');
    await prisma.brokeragePayout.update({ where: { id }, data: { status, paidAt: status === 'PAID' ? new Date() : null } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'BrokeragePayout', entityId: id, summary: `Payout → ${status}` });
    revalidatePath('/partners'); return { ok: true };
  } catch (err) { return toActionError(err); }
}

const cpLeadSchema = z.object({
  channelPartnerId: z.string().min(1),
  name: z.string().min(2).max(120),
  phone: z.string().min(5).max(30),
  email: z.string().email().optional().or(z.literal('')),
  projectId: z.string().optional().nullable(),
  requirement: z.string().max(300).optional(),
});
/** Register a client brought by a channel partner — locked to them for 60 days (commission protection). */
export async function registerCpLead(input: unknown): Promise<PartnerResult> {
  try {
    const ctx = await ensure('booking.manage');
    const d = cpLeadSchema.parse(input);
    const email = d.email ? d.email.toLowerCase() : null;
    const existing = await prisma.lead.findFirst({
      where: { deletedAt: null, OR: [{ phone: d.phone }, ...(email ? [{ email }] : [])] },
      select: { id: true, channelPartnerId: true, cpLockedUntil: true },
    });
    if (existing?.channelPartnerId && existing.channelPartnerId !== d.channelPartnerId && existing.cpLockedUntil && existing.cpLockedUntil > new Date()) {
      return { error: `This client is already locked to another channel partner until ${existing.cpLockedUntil.toLocaleDateString('en-IN')}.` };
    }
    const lockUntil = new Date(Date.now() + 60 * 864e5);
    if (existing) {
      await prisma.lead.update({ where: { id: existing.id }, data: { channelPartnerId: d.channelPartnerId, cpLockedUntil: lockUntil, source: 'BROKER' } });
      await prisma.leadActivity.create({ data: { leadId: existing.id, userId: ctx.user.id, type: 'NOTE', subject: 'Channel-partner registration', notes: 'Locked to CP for 60 days' } });
      revalidatePath('/partners'); return { ok: true, id: existing.id };
    }
    const reference = await nextReference('LEAD');
    const lead = await prisma.lead.create({
      data: {
        reference, name: d.name, phone: d.phone, email, source: 'BROKER', requirement: d.requirement || null,
        projectId: d.projectId || null, ownerId: ctx.user.id, channelPartnerId: d.channelPartnerId, cpLockedUntil: lockUntil,
        activities: { create: { userId: ctx.user.id, type: 'NOTE', subject: 'Registered by channel partner', notes: 'Locked to CP for 60 days' } },
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Lead', entityId: lead.id, summary: `CP-registered lead ${reference}` });
    revalidatePath('/partners'); return { ok: true, id: lead.id };
  } catch (err) { return toActionError(err); }
}

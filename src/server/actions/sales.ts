'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { LeadStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { nextReference } from '@/lib/utils/reference';
import { writeAudit } from '@/lib/audit/log';
import { notify } from '@/lib/notifications/notify';
import { runAutomations } from '@/lib/automation/engine';
import { isGeminiEnabled, scoreLeadWithGemini } from '@/lib/ai/gemini';
import { ensure, getActionContext, toActionError } from './_helpers';

const leadSchema = z.object({
  name: z.string().min(2).max(160),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  source: z.enum(['WEBSITE', 'REFERRAL', 'WALK_IN', 'CAMPAIGN', 'PORTAL', 'NRI_DESK', 'BROKER', 'OTHER']).default('WEBSITE'),
  requirement: z.string().max(1000).optional(),
  budgetMin: z.coerce.number().nonnegative().optional(),
  budgetMax: z.coerce.number().nonnegative().optional(),
  projectId: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  isNri: z.boolean().default(false),
  country: z.string().optional(),
  timezone: z.string().optional(),
});

export type SalesResult = { ok: true; id: string } | { error: string };

export async function createLead(input: unknown): Promise<SalesResult> {
  try {
    const ctx = await ensure('lead.create');
    const d = leadSchema.parse(input);
    const reference = await nextReference('LEAD');
    const lead = await prisma.lead.create({
      data: {
        reference, name: d.name, email: d.email || null, phone: d.phone || null, source: d.source,
        requirement: d.requirement || null, budgetMin: d.budgetMin ?? null, budgetMax: d.budgetMax ?? null,
        projectId: d.projectId || null, ownerId: d.ownerId || ctx.user.id, isNri: d.isNri,
        country: d.country || null, timezone: d.timezone || null,
        activities: { create: { userId: ctx.user.id, type: 'NOTE', subject: 'Lead created' } },
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Lead', entityId: lead.id, summary: `Created lead ${reference}` });
    if (d.ownerId && d.ownerId !== ctx.user.id) {
      await notify({ userId: d.ownerId, type: 'SYSTEM', title: `New lead assigned: ${d.name}`, link: `/sales/${lead.id}` });
    }
    await runAutomations('LEAD_CREATED', { entityType: 'Lead', entityId: lead.id, data: { name: lead.name, email: lead.email, phone: lead.phone, source: lead.source, status: lead.status, score: lead.score, isNri: lead.isNri, country: lead.country }, actorId: ctx.user.id });
    revalidatePath('/sales');
    return { ok: true, id: lead.id };
  } catch (err) {
    return toActionError(err);
  }
}

export async function moveLeadStage(leadId: string, status: LeadStatus): Promise<SalesResult> {
  try {
    const ctx = await ensure('lead.update');
    const lead = await prisma.lead.update({ where: { id: leadId }, data: { status } });
    await prisma.leadActivity.create({ data: { leadId, userId: ctx.user.id, type: 'NOTE', subject: `Stage → ${status}` } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Lead', entityId: leadId, summary: `${lead.reference} → ${status}` });
    await runAutomations('LEAD_STAGE_CHANGED', { entityType: 'Lead', entityId: leadId, data: { name: lead.name, email: lead.email, source: lead.source, status, score: lead.score, isNri: lead.isNri, country: lead.country }, actorId: ctx.user.id });
    revalidatePath('/sales');
    return { ok: true, id: leadId };
  } catch (err) {
    return toActionError(err);
  }
}

const activitySchema = z.object({
  leadId: z.string(),
  type: z.enum(['CALL', 'MEETING', 'NOTE', 'SITE_VISIT', 'EMAIL', 'WHATSAPP', 'DOCUMENT']),
  subject: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export async function logLeadActivity(input: unknown): Promise<SalesResult> {
  try {
    const ctx = await getActionContext();
    const d = activitySchema.parse(input);
    await prisma.leadActivity.create({ data: { leadId: d.leadId, userId: ctx.user.id, type: d.type, subject: d.subject, notes: d.notes } });
    revalidatePath(`/sales/${d.leadId}`);
    return { ok: true, id: d.leadId };
  } catch (err) {
    return toActionError(err);
  }
}

// ─── Bookings & payments (Sales depth) ──────────────────────────────────────

const bookingSchema = z.object({
  leadId: z.string().min(1),
  unitId: z.string().optional().nullable(),
  agreementValue: z.coerce.number().nonnegative().optional(),
  milestones: z.array(z.object({
    label: z.string().min(1),
    amount: z.coerce.number().nonnegative(),
    dueDate: z.string().optional().nullable(),
  })).default([]),
});

/** Convert a qualified lead into a booking (optionally against a unit) with a
 *  payment plan. Marks the unit BOOKED and advances the lead to BOOKED. */
export async function createBooking(input: unknown): Promise<SalesResult> {
  try {
    const ctx = await ensure('booking.manage');
    const d = bookingSchema.parse(input);
    const reference = await nextReference('BKG');
    const booking = await prisma.booking.create({
      data: {
        reference, leadId: d.leadId, unitId: d.unitId || null, salesRepId: ctx.user.id,
        status: 'CONFIRMED', paymentStatus: d.milestones.length ? 'PENDING' : 'PENDING',
        agreementValue: d.agreementValue ?? null,
        payments: { create: d.milestones.map((m) => ({ label: m.label, amount: m.amount, dueDate: m.dueDate ? new Date(m.dueDate) : null })) },
      },
    });
    if (d.unitId) await prisma.unit.update({ where: { id: d.unitId }, data: { status: 'BOOKED' } }).catch(() => {});
    await prisma.lead.update({ where: { id: d.leadId }, data: { status: 'BOOKED' } }).catch(() => {});
    await prisma.leadActivity.create({ data: { leadId: d.leadId, userId: ctx.user.id, type: 'NOTE', subject: `Booking ${reference} created` } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Booking', entityId: booking.id, summary: `Created booking ${reference}` });
    revalidatePath(`/sales/${d.leadId}`);
    return { ok: true, id: booking.id };
  } catch (err) { return toActionError(err); }
}

/** Mark a payment milestone paid and recompute the booking's payment status. */
export async function markMilestonePaid(milestoneId: string): Promise<SalesResult> {
  try {
    const ctx = await ensure('booking.manage');
    const milestone = await prisma.paymentMilestone.update({
      where: { id: milestoneId }, data: { status: 'PAID', paidAt: new Date() },
    });
    const all = await prisma.paymentMilestone.findMany({ where: { bookingId: milestone.bookingId } });
    const paid = all.filter((m) => m.status === 'PAID').length;
    const paymentStatus = paid === all.length ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING';
    await prisma.booking.update({ where: { id: milestone.bookingId }, data: { paymentStatus } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'PaymentMilestone', entityId: milestoneId, summary: 'Marked paid' });
    revalidatePath('/sales');
    return { ok: true, id: milestone.bookingId };
  } catch (err) { return toActionError(err); }
}

/** Schedule the next follow-up for a lead (used by the NRI desk). */
export async function scheduleFollowUp(leadId: string, at: string): Promise<SalesResult> {
  try {
    const ctx = await ensure('lead.update');
    if (!at) return { error: 'Pick a date & time.' };
    await prisma.lead.update({ where: { id: leadId }, data: { nextFollowUp: new Date(at) } });
    await prisma.leadActivity.create({ data: { leadId, userId: ctx.user.id, type: 'MEETING', subject: 'Follow-up scheduled', scheduledAt: new Date(at) } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Lead', entityId: leadId, summary: 'Scheduled follow-up' });
    revalidatePath('/nri'); revalidatePath(`/sales/${leadId}`);
    return { ok: true, id: leadId };
  } catch (err) { return toActionError(err); }
}

const cancelSchema = z.object({ bookingId: z.string().min(1), forfeitAmount: z.coerce.number().nonnegative().default(0), reason: z.string().max(300).optional() });
/** Cancel a booking: compute forfeiture/refund, release the unit back to available inventory. */
export async function cancelBooking(input: unknown): Promise<SalesResult> {
  try {
    const ctx = await ensure('booking.manage');
    const d = cancelSchema.parse(input);
    const booking = await prisma.booking.findUnique({ where: { id: d.bookingId } });
    if (!booking) return { error: 'Booking not found.' };
    if (booking.status === 'CANCELLED') return { error: 'This booking is already cancelled.' };
    const paidAgg = await prisma.paymentMilestone.aggregate({ where: { bookingId: d.bookingId, status: 'PAID' }, _sum: { amount: true } });
    const paid = Number(paidAgg._sum.amount ?? 0);
    const refund = Math.max(0, paid - d.forfeitAmount);
    await prisma.booking.update({ where: { id: d.bookingId }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: d.reason || null, forfeitAmount: d.forfeitAmount, refundAmount: refund } });
    if (booking.unitId) await prisma.unit.update({ where: { id: booking.unitId }, data: { status: 'AVAILABLE', holdUntil: null, heldForLeadId: null, heldById: null, tokenAmount: null, holdNote: null } });
    if (booking.leadId) await prisma.leadActivity.create({ data: { leadId: booking.leadId, userId: ctx.user.id, type: 'NOTE', subject: `Booking ${booking.reference} cancelled`, notes: `Forfeit Rs.${d.forfeitAmount.toFixed(0)} · refund Rs.${refund.toFixed(0)}${d.reason ? ` — ${d.reason}` : ''}` } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Booking', entityId: d.bookingId, summary: `Cancelled ${booking.reference} (forfeit Rs.${d.forfeitAmount.toFixed(0)}, refund Rs.${refund.toFixed(0)})` });
    revalidatePath('/sales'); revalidatePath('/inventory');
    return { ok: true, id: d.bookingId };
  } catch (err) { return toActionError(err); }
}

/** AI-score a lead with Gemini: sets lead.score and logs the reason + next-best-action. */
export async function scoreLead(leadId: string): Promise<SalesResult> {
  try {
    const ctx = await ensure('lead.update');
    if (!isGeminiEnabled()) return { error: 'Gemini API key is not configured (set GEMINI_API_KEY).' };
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { project: { select: { name: true } }, activities: { orderBy: { occurredAt: 'desc' }, take: 8, select: { type: true, subject: true, notes: true } } } });
    if (!lead) return { error: 'Lead not found.' };
    const summary = [
      `Name: ${lead.name}`, `Source: ${lead.source}`, `Status: ${lead.status}`,
      `Budget: ${lead.budgetMin ? Number(lead.budgetMin) : '?'} - ${lead.budgetMax ? Number(lead.budgetMax) : '?'}`,
      `Project interest: ${lead.project?.name ?? '-'}`, `NRI: ${lead.isNri ? 'yes (' + (lead.country ?? '') + ')' : 'no'}`,
      `Requirement: ${lead.requirement ?? '-'}`,
      'Recent activity:', ...lead.activities.map((a) => `- ${a.type}: ${a.subject ?? ''} ${a.notes ?? ''}`.trim()),
    ].join('\n');
    const res = await scoreLeadWithGemini(summary);
    if (!res) return { error: 'Could not score this lead right now.' };
    await prisma.lead.update({ where: { id: leadId }, data: { score: res.score } });
    await prisma.leadActivity.create({ data: { leadId, userId: ctx.user.id, type: 'NOTE', subject: `AI lead score: ${res.score}/100`, notes: `${res.reason} — Next best action: ${res.nextAction}` } });
    revalidatePath(`/sales/${leadId}`); revalidatePath('/sales');
    return { ok: true, id: leadId };
  } catch (err) { return toActionError(err); }
}

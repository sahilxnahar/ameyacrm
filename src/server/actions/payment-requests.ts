'use server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { sendEmail } from '@/lib/email/email';
import { getCompanyDetails } from '@/server/services/company-service';
import { bankBlock } from '@/config/company';
import { writeAudit } from '@/lib/audit/log';
import { env } from '@/config/env';
import { checkRate, callerIp } from '@/lib/security/rate-limit';
import { ensure, toActionError } from './_helpers';

/** Split "a@x.com, b@y.com; c@z.com" into a clean list. */
function splitEmails(v?: string | null): string[] {
  return (v ?? '').split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export type PayResult = { ok: true; id?: string; link?: string; emailed?: boolean; emailError?: string } | { error: string };

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const money = (n: number) => `Rs. ${inr.format(n)}`;
const baseUrl = () => (env.APP_URL || '').replace(/\/$/, '');

const createSchema = z.object({
  payeeName: z.string().min(2).max(160),
  payeeEmail: z.string().optional().or(z.literal('')).refine(
    (v) => !v || splitEmails(v).every((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)),
    'One of those email addresses is not valid. Separate several with commas.',
  ),
  payeePhone: z.string().max(30).optional(),
  amount: z.coerce.number().positive(),
  description: z.string().min(3).max(1000),
  dueDate: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
});

/** Raise a payment request and email the payee a secure link. */
export async function createPaymentRequest(input: unknown): Promise<PayResult> {
  try {
    const ctx = await ensure('billing.invoice.manage');
    const d = createSchema.parse(input);
    const seq = (await prisma.paymentRequest.count()) + 1001;
    const reference = `PAY-${seq}`;
    const token = randomBytes(20).toString('hex');

    const pr = await prisma.paymentRequest.create({
      data: {
        reference, token, payeeName: d.payeeName, payeeEmail: splitEmails(d.payeeEmail).join(', ') || null, payeePhone: d.payeePhone || null,
        amount: d.amount, description: d.description, dueDate: d.dueDate ? new Date(d.dueDate) : null,
        customerId: d.customerId || null, requestedById: ctx.user.id, requestedByName: ctx.user.name,
      },
    });

    const link = `${baseUrl()}/pay/${token}`;
    let emailed = false;
    let emailError: string | undefined;
    if (d.payeeEmail) {
      const saved = String((await prisma.setting.findUnique({ where: { key: 'payments.instructions' } }))?.value ?? '');
      const instructions = saved || bankBlock(await getCompanyDetails());
      const text = [
        `Dear ${d.payeeName},`,
        '',
        `${ctx.user.name} has requested a payment of ${money(d.amount)} towards:`,
        `"${d.description}"`,
        '',
        d.dueDate ? `Due by: ${new Date(d.dueDate).toLocaleDateString('en-IN')}` : '',
        `Reference: ${reference}`,
        '',
        'View the request and payment details here:',
        link,
        '',
        instructions ? `Payment details:\n${instructions}` : '',
        '',
        '— Ameya Heights LLP',
      ].filter(Boolean).join('\n');
      const res = await sendEmail({ to: splitEmails(d.payeeEmail), subject: `Payment request ${reference} — ${money(d.amount)}`, text });
      emailed = res.ok;
      if (!res.ok) { emailError = res.error ?? 'email not configured'; console.error('[payment-request] email failed:', emailError); }
      if (res.ok) await prisma.paymentRequest.update({ where: { id: pr.id }, data: { emailSentAt: new Date() } });
    }

    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'PaymentRequest', entityId: pr.id, summary: `Requested ${money(d.amount)} from ${d.payeeName} (${reference})` });
    revalidatePath('/payment-requests');
    return { ok: true, id: pr.id, link, emailed, emailError };
  } catch (err) { return toActionError(err); }
}

export async function resendPaymentRequest(id: string): Promise<PayResult> {
  try {
    const ctx = await ensure('billing.invoice.manage');
    const pr = await prisma.paymentRequest.findUnique({ where: { id } });
    if (!pr) return { error: 'Request not found.' };
    if (!pr.payeeEmail) return { error: 'This request has no email address on it.' };
    const link = `${baseUrl()}/pay/${pr.token}`;
    const text = `Dear ${pr.payeeName},\n\nReminder: ${pr.requestedByName ?? 'Ameya Heights'} has requested a payment of ${money(Number(pr.amount))} towards:\n"${pr.description}"\n\nReference: ${pr.reference}\n\n${link}\n\n— Ameya Heights LLP`;
    const res = await sendEmail({ to: splitEmails(pr.payeeEmail), subject: `Reminder: payment request ${pr.reference}`, text });
    if (!res.ok) return { error: `Could not send: ${res.error ?? 'email not configured'}` };
    await prisma.paymentRequest.update({ where: { id }, data: { emailSentAt: new Date() } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'PaymentRequest', entityId: id, summary: `Resent ${pr.reference}` });
    revalidatePath('/payment-requests');
    return { ok: true, emailed: true };
  } catch (err) { return toActionError(err); }
}

export async function setPaymentRequestStatus(id: string, status: 'PENDING' | 'PAID' | 'CANCELLED'): Promise<PayResult> {
  try {
    const ctx = await ensure('billing.invoice.manage');
    const pr = await prisma.paymentRequest.update({ where: { id }, data: { status, paidAt: status === 'PAID' ? new Date() : null } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'PaymentRequest', entityId: id, summary: `${pr.reference} → ${status}` });
    revalidatePath('/payment-requests');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** PUBLIC — the payee confirms they have paid, quoting a UTR/reference. */
export async function confirmPayment(token: string, payerReference: string): Promise<{ ok: true } | { error: string }> {
  try {
    const ref = String(payerReference || '').trim().slice(0, 80);
    if (ref.length < 3) return { error: 'Enter the transaction / UTR reference.' };
    const pr = await prisma.paymentRequest.findUnique({ where: { token }, select: { id: true, status: true, reference: true, requestedById: true, payeeName: true } });
    if (!pr) return { error: 'This payment link is not valid.' };
    if (pr.status === 'CANCELLED') return { error: 'This request has been cancelled.' };
    await prisma.paymentRequest.update({ where: { id: pr.id }, data: { status: 'CONFIRMED', payerReference: ref } });
    if (pr.requestedById) {
      const { notify } = await import('@/lib/notifications/notify');
      await notify({ userId: pr.requestedById, type: 'SYSTEM', title: `${pr.payeeName} marked ${pr.reference} as paid`, body: `Reference: ${ref}. Verify and mark it paid.`, link: '/payment-requests' });
    }
    revalidatePath(`/pay/${token}`); revalidatePath('/payment-requests');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Admin: save bank / UPI details shown on the request page and in emails. */
export async function savePaymentInstructions(text: string): Promise<PayResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const v = String(text || '').slice(0, 2000);
    await prisma.setting.upsert({ where: { key: 'payments.instructions' }, update: { value: v }, create: { key: 'payments.instructions', value: v } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Setting', summary: 'Updated payment instructions' });
    revalidatePath('/payment-requests');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

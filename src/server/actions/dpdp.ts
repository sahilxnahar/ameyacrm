'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { sendEmail } from '@/lib/email/email';
import { writeAudit } from '@/lib/audit/log';
import { nextSequence, docNumber } from '@/lib/db/sequence';
import { ensure, toActionError } from '@/server/actions/_helpers';

export type DpdpResult = { ok: true; message?: string; data?: unknown } | { error: string };

const requestSchema = z.object({
  type: z.enum(['EXPORT', 'DELETE', 'CORRECTION']),
  subjectName: z.string().min(2).max(120),
  subjectEmail: z.string().email(),
  subjectPhone: z.string().max(20).optional().or(z.literal('')),
  details: z.string().max(1000).optional(),
});

export async function createDataRequest(input: unknown): Promise<DpdpResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const d = requestSchema.parse(input);
    // Atomic, not count()+1 — DataRequest.reference is unique and two DSRs
    // raised in the same second would otherwise collide.
    const seq = await nextSequence('ref:DSR', prisma, 1000);
    await prisma.dataRequest.create({
      data: {
        reference: docNumber('DSR', seq), type: d.type,
        subjectName: d.subjectName, subjectEmail: d.subjectEmail.toLowerCase(),
        subjectPhone: d.subjectPhone || null, details: d.details || null,
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Setting', summary: `Logged a ${d.type} data request for ${d.subjectEmail}` });
    revalidatePath('/admin/privacy');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Everything the CRM holds about one person, gathered from every table. */
export async function gatherPersonalData(email: string, phone?: string | null): Promise<DpdpResult> {
  try {
    await ensure('admin.setting.manage');
    const e = email.toLowerCase().trim();
    const orWhere = [{ email: e }, ...(phone ? [{ phone }] : [])];

    const [leads, customers, bookings, socials, payments] = await Promise.all([
      prisma.lead.findMany({ where: { OR: orWhere } }),
      prisma.customer.findMany({ where: { OR: orWhere } }),
      prisma.booking.findMany({ where: { lead: { OR: orWhere } }, include: { unit: { select: { code: true } } } }),
      prisma.socialActivity.findMany({ where: { message: { contains: e, mode: 'insensitive' } } }),
      prisma.paymentRequest.findMany({ where: { payeeEmail: e } }),
    ]);

    return {
      ok: true,
      data: {
        generatedAt: new Date().toISOString(),
        subject: { email: e, phone: phone ?? null },
        leads, customers, bookings, socialActivity: socials, paymentRequests: payments,
        note: 'This is every record the Ameya Heights CRM holds against this email or phone number.',
      },
    };
  } catch (err) { return toActionError(err); }
}

/**
 * Erase a person from the CRM. Financial records are anonymised rather than
 * deleted — Indian tax law requires them to be retained, and DPDP allows that.
 */
export async function erasePersonalData(email: string, reason: string): Promise<DpdpResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const e = email.toLowerCase().trim();
    const stamp = `erased-${Date.now()}`;

    // Every erased lead gets the identical value, so one statement does it.
    const leads = await prisma.lead.findMany({ where: { email: e }, select: { id: true } });
    if (leads.length) {
      await prisma.lead.updateMany({
        where: { id: { in: leads.map((l) => l.id) } },
        data: {
          name: 'Erased at request', email: null, phone: null, requirement: null,
          locality: null, latitude: null, longitude: null,
          consentAt: null, consentSource: null, deletedAt: new Date(),
        },
      });
    }

    // Same for customers. Customer.email is nullable and NOT unique (checked —
    // only portalToken is), so every matching row can take the same placeholder
    // in one statement, exactly as the loop did one at a time.
    const customersErased = await prisma.customer.updateMany({
      where: { email: e },
      data: { name: 'Erased at request', email: `${stamp}@erased.invalid`, phone: null, isActive: false },
    });

    await prisma.paymentRequest.updateMany({ where: { payeeEmail: e }, data: { payeeEmail: null, payeePhone: null } });

    // F-27: the discovery step (gatherPersonalData) also finds the subject in
    // social-activity messages, which the erase step previously left untouched —
    // leaving the person re-identifiable after a "right to be forgotten" request.
    // (Bookings carry no PII of their own; they resolve through the lead, which is
    // erased above.)
    await prisma.socialActivity.updateMany({ where: { message: { contains: e, mode: 'insensitive' } }, data: { message: '[erased at request]' } }).catch(() => undefined);

    await writeAudit({
      actorId: ctx.user.id, action: 'DELETE', entityType: 'Setting',
      summary: `DPDP erasure for ${e}: ${leads.length} leads, ${customersErased.count} buyers. Reason: ${reason.slice(0, 200)}`,
    });

    await sendEmail({
      to: [e],
      subject: 'Your data has been erased',
      text: `We have removed your personal information from the Ameya Heights CRM as requested.\n\nFinancial and statutory records are retained in anonymised form where Indian law requires it.\n\n— Ameya Heights LLP`,
    }).catch(() => undefined);

    revalidatePath('/admin/privacy');
    return { ok: true, message: `Erased ${leads.length} lead records and ${customersErased.count} buyer records.` };
  } catch (err) { return toActionError(err); }
}

export async function setDataRequestStatus(id: string, status: 'RECEIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED', notes?: string): Promise<DpdpResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    await prisma.dataRequest.update({
      where: { id },
      data: { status, notes: notes || undefined, handledById: ctx.user.id, handledAt: status === 'COMPLETED' ? new Date() : undefined },
    });
    revalidatePath('/admin/privacy');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function saveRetentionPolicy(months: number): Promise<DpdpResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    await prisma.setting.upsert({ where: { key: 'dpdp.retentionMonths' }, update: { value: months }, create: { key: 'dpdp.retentionMonths', value: months } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Setting', summary: `Retention set to ${months} months` });
    revalidatePath('/admin/privacy');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

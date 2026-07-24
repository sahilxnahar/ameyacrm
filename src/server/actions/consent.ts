'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { CONSENT_PURPOSE_KEYS } from '@/lib/privacy/consent';
import { ensure, toActionError } from './_helpers';

export type ConsentResult = { ok: true } | { error: string };

const schema = z.object({
  subjectEmail: z.string().email().optional().or(z.literal('')),
  subjectPhone: z.string().max(20).optional().or(z.literal('')),
  subjectName: z.string().max(120).optional().or(z.literal('')),
  purpose: z.enum(CONSENT_PURPOSE_KEYS as unknown as [string, ...string[]]),
  status: z.enum(['GIVEN', 'WITHDRAWN']),
  note: z.string().max(300).optional(),
});

/** Record a consent event (given or withdrawn) for a purpose. Append-only. */
export async function recordConsent(input: unknown): Promise<ConsentResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const d = schema.parse(input);
    if (!d.subjectEmail && !d.subjectPhone) return { error: 'Give an email or a phone number.' };
    await prisma.consentRecord.create({
      data: {
        subjectEmail: d.subjectEmail ? d.subjectEmail.toLowerCase() : null,
        subjectPhone: d.subjectPhone || null,
        subjectName: d.subjectName || null,
        purpose: d.purpose, status: d.status, source: 'admin',
        note: d.note || null, createdById: ctx.user.id,
      },
    });
    // Keep the Lead's quick consent flags in step for marketing consent.
    if (d.subjectEmail && d.purpose === 'MARKETING') {
      await prisma.lead.updateMany({
        where: { email: d.subjectEmail.toLowerCase(), deletedAt: null },
        data: d.status === 'GIVEN'
          ? { consentAt: new Date(), consentSource: 'admin' }
          : { consentAt: null, consentSource: null },
      }).catch(() => undefined);
    }
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'ConsentRecord', summary: `Consent ${d.status} for ${d.purpose} (${d.subjectEmail || d.subjectPhone})` });
    revalidatePath('/admin/privacy');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** The full consent trail for one person, for the admin view. */
export async function consentHistory(emailOrPhone: string): Promise<{ ok: true; rows: Array<{ id: string; purpose: string; status: string; source: string | null; note: string | null; at: string }> } | { error: string }> {
  try {
    await ensure('admin.setting.manage');
    const v = String(emailOrPhone || '').trim();
    if (!v) return { ok: true, rows: [] };
    const rows = await prisma.consentRecord.findMany({
      where: { OR: [{ subjectEmail: v.toLowerCase() }, { subjectPhone: v }] },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { ok: true, rows: rows.map((r) => ({ id: r.id, purpose: r.purpose, status: r.status, source: r.source, note: r.note, at: r.createdAt.toISOString() })) };
  } catch (err) { return toActionError(err); }
}

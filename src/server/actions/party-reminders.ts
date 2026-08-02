'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { activeTallyCompanyId } from '@/lib/tally/company';
import { writeAudit } from '@/lib/audit/log';
import { sendEmail } from '@/lib/email/email';
import { getOpenBillsFor } from '@/server/services/tally-bills-service';
import { buildReminder, remindersEnabled, REMINDERS_ENABLED_KEY, CADENCES, type Cadence } from '@/server/services/party-reminder-service';
import { env } from '@/config/env';

export type ReminderResult = { ok: true; message?: string } | { error: string };

const schema = z.object({
  ledgerId: z.string().min(1),
  email: z.string().email('That does not look like an email address'),
  ccEmail: z.string().email('That CC address does not look right').optional().or(z.literal('')),
  cadence: z.enum(['OFF', 'WEEKLY', 'FORTNIGHTLY', 'MONTHLY']),
  onlyWhenOverdue: z.boolean().default(true),
  note: z.string().max(300).optional().or(z.literal('')),
  pausedUntil: z.string().optional().or(z.literal('')),
});

/** Set (or change) how often a party is chased. */
export async function savePartyReminder(input: unknown): Promise<ReminderResult> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    const d = schema.parse(input);
    const companyId = await activeTallyCompanyId();

    const ledger = await prisma.tallyLedger.findFirst({
      where: { id: d.ledgerId, companyId }, select: { id: true, name: true },
    });
    if (!ledger) return { error: 'That party is not in this company’s books.' };

    await prisma.tallyPartyReminder.upsert({
      where: { ledgerId: d.ledgerId },
      update: {
        email: d.email, ccEmail: d.ccEmail || null, cadence: d.cadence,
        onlyWhenOverdue: d.onlyWhenOverdue, note: d.note || null,
        pausedUntil: d.pausedUntil ? new Date(d.pausedUntil) : null,
      },
      create: {
        companyId, ledgerId: d.ledgerId, email: d.email, ccEmail: d.ccEmail || null,
        cadence: d.cadence, onlyWhenOverdue: d.onlyWhenOverdue, note: d.note || null,
        pausedUntil: d.pausedUntil ? new Date(d.pausedUntil) : null,
      },
    });

    await writeAudit({
      actorId: ctx.user.id, action: 'UPDATE', entityType: 'TallyLedger', entityId: d.ledgerId,
      summary: d.cadence === 'OFF'
        ? `Turned off payment reminders for ${ledger.name}`
        : `Payment reminders to ${d.email} for ${ledger.name}: ${CADENCES[d.cadence as Cadence].label.toLowerCase()}`,
    });

    revalidatePath('/tally');
    const warn = !(await remindersEnabled()) && d.cadence !== 'OFF'
      ? ' Reminders are still switched off globally — turn them on in Settings before anything sends.'
      : '';
    return { ok: true, message: `Saved.${warn}` };
  } catch (e) { return toActionError(e); }
}

/** What a party would receive right now, without sending anything. */
export async function previewPartyReminder(ledgerId: string): Promise<{ ok: true; subject: string; text: string; bills: number } | { error: string }> {
  try {
    await ensure('finance.ledger.view');
    const companyId = await activeTallyCompanyId();
    const ledger = await prisma.tallyLedger.findFirst({ where: { id: ledgerId, companyId }, select: { name: true } });
    if (!ledger) return { error: 'That party is not in this company’s books.' };

    const bills = (await getOpenBillsFor(companyId, ledgerId)).filter((b) => b.outstanding > 0);
    if (bills.length === 0) return { error: `${ledger.name} has nothing outstanding — no reminder would be sent.` };

    const total = bills.reduce((s, b) => s + b.outstanding, 0);
    const rem = await prisma.tallyPartyReminder.findUnique({ where: { ledgerId }, select: { note: true } });
    const { subject, text } = buildReminder(ledger.name, bills, total, rem?.note);
    return { ok: true, subject, text, bills: bills.length };
  } catch (e) { return toActionError(e); }
}

/**
 * Send the reminder to YOURSELF, so you can see exactly what the party would
 * get before any of it goes out. Deliberately never sends to the party.
 */
export async function sendTestReminder(ledgerId: string): Promise<ReminderResult> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    const preview = await previewPartyReminder(ledgerId);
    if ('error' in preview) return preview;
    if (!ctx.user.email) return { error: 'Your account has no email address to send the test to.' };

    if (env.EMAIL_PROVIDER === 'console') {
      return { error: 'Email is not configured yet — nothing can actually send. Set EMAIL_PROVIDER and the mail credentials first (see PORTING/02-ENVIRONMENT.md).' };
    }

    await sendEmail({
      to: [ctx.user.email],
      subject: `[TEST] ${preview.subject}`,
      text: `This is a test. The party will NOT receive this copy.\n\n---\n\n${preview.text}`,
    });
    return { ok: true, message: `Test sent to ${ctx.user.email}. The party was not contacted.` };
  } catch (e) { return toActionError(e); }
}

/** The master switch for all outbound chasing. */
export async function setRemindersEnabled(on: boolean): Promise<ReminderResult> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    await prisma.setting.upsert({
      where: { key: REMINDERS_ENABLED_KEY },
      update: { value: String(on) },
      create: { key: REMINDERS_ENABLED_KEY, value: String(on) },
    });
    await writeAudit({
      actorId: ctx.user.id, action: 'UPDATE', entityType: 'Setting', entityId: REMINDERS_ENABLED_KEY,
      summary: on ? 'Turned ON automatic payment reminders' : 'Turned OFF automatic payment reminders',
    });
    revalidatePath('/tally');
    return { ok: true, message: on ? 'Reminders are on.' : 'Reminders are off. Nothing will be sent.' };
  } catch (e) { return toActionError(e); }
}

/** Current settings for a party, plus what has already gone out. */
export async function getPartyReminder(ledgerId: string) {
  try {
    await ensure('finance.ledger.view');
    const r = await prisma.tallyPartyReminder.findUnique({
      where: { ledgerId },
      include: { sends: { orderBy: { sentAt: 'desc' }, take: 5 } },
    });
    return {
      ok: true as const,
      globalOn: await remindersEnabled(),
      emailConfigured: env.EMAIL_PROVIDER !== 'console',
      reminder: r && {
        email: r.email, ccEmail: r.ccEmail, cadence: r.cadence, onlyWhenOverdue: r.onlyWhenOverdue,
        note: r.note, pausedUntil: r.pausedUntil?.toISOString().slice(0, 10) ?? null,
        lastSentAt: r.lastSentAt?.toISOString().slice(0, 10) ?? null, sentCount: r.sentCount,
        sends: r.sends.map((s) => ({
          at: s.sentAt.toISOString().slice(0, 10), amount: Number(s.amount), ok: s.ok, error: s.error,
        })),
      },
    };
  } catch (e) { return toActionError(e); }
}

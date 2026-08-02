import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { sendEmail } from '@/lib/email/email';
import { getBillWiseReport } from '@/server/services/tally-bills-service';
import { startOfTodayIST } from '@/lib/date/ist';

/**
 * Automatic payment reminders to the people who owe you money.
 *
 * The rules below exist because this is outbound email to third parties, and
 * the cost of getting it wrong is a buyer or a vendor receiving three chasing
 * emails in a day. Every one of them is a hard gate, not a preference:
 *
 *   1. OFF unless somebody switched it on for that party.
 *   2. Nothing goes out if the balance is clear.
 *   3. `onlyWhenOverdue` (the default) means nothing goes out before a bill is
 *      actually late — chasing money that is not yet due annoys good payers.
 *   4. A minimum gap of 5 days is enforced whatever the cadence says, so a
 *      mis-set schedule cannot turn into a daily barrage.
 *   5. `pausedUntil` beats everything — for "they have promised the 15th".
 *   6. One switch in Settings stops all of it.
 */
export const CADENCES = {
  OFF: { label: 'Off', days: 0 },
  WEEKLY: { label: 'Every week', days: 7 },
  FORTNIGHTLY: { label: 'Every two weeks', days: 14 },
  MONTHLY: { label: 'Every month', days: 30 },
} as const;

export type Cadence = keyof typeof CADENCES;

/** However eager the cadence, never chase the same party more often than this. */
export const MIN_GAP_DAYS = 5;

/** The master switch. Off by default: nothing sends until it is deliberately enabled. */
export const REMINDERS_ENABLED_KEY = 'collections.remindersEnabled';

export async function remindersEnabled(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: REMINDERS_ENABLED_KEY } }).catch(() => null);
  return row?.value === 'true';
}

export interface ReminderRun {
  considered: number;
  sent: number;
  skipped: Array<{ party: string; why: string }>;
  failed: number;
}

/**
 * The daily sweep. Safe to run more than once a day — the gap check means a
 * second run sends nothing.
 */
export async function runPartyReminders(now = new Date()): Promise<ReminderRun> {
  const res: ReminderRun = { considered: 0, sent: 0, skipped: [], failed: 0 };

  if (!(await remindersEnabled())) {
    res.skipped.push({ party: '(all)', why: 'Reminders are switched off in Settings' });
    return res;
  }

  const schedules = await prisma.tallyPartyReminder.findMany({
    where: { cadence: { not: 'OFF' } },
    include: { ledger: { select: { id: true, name: true, companyId: true } } },
  }).catch(() => []);
  res.considered = schedules.length;
  if (schedules.length === 0) return res;

  // One report per company, not per party.
  const byCompany = new Map<string, Awaited<ReturnType<typeof getBillWiseReport>>>();
  for (const s of schedules) {
    if (!byCompany.has(s.companyId)) {
      byCompany.set(s.companyId, await getBillWiseReport(s.companyId, now));
    }
  }

  const today = startOfTodayIST(now);

  for (const s of schedules) {
    const name = s.ledger?.name ?? 'party';

    if (s.pausedUntil && s.pausedUntil > now) {
      res.skipped.push({ party: name, why: `paused until ${s.pausedUntil.toISOString().slice(0, 10)}` });
      continue;
    }

    const cadenceDays = CADENCES[(s.cadence as Cadence)]?.days ?? 0;
    if (cadenceDays <= 0) continue;

    const gapDays = Math.max(cadenceDays, MIN_GAP_DAYS);
    if (s.lastSentAt && now.getTime() - s.lastSentAt.getTime() < gapDays * 86400_000) {
      res.skipped.push({ party: name, why: 'chased recently' });
      continue;
    }

    const report = byCompany.get(s.companyId);
    const party = report?.receivables.find((p) => p.ledgerId === s.ledgerId);
    if (!party || party.total <= 0) {
      res.skipped.push({ party: name, why: 'nothing outstanding' });
      continue;
    }

    const bills = s.onlyWhenOverdue ? party.bills.filter((b) => b.daysOverdue > 0) : party.bills;
    if (bills.length === 0) {
      res.skipped.push({ party: name, why: 'nothing overdue yet' });
      continue;
    }

    const amount = bills.reduce((sum, b) => sum + b.outstanding, 0);
    const { subject, text, html } = buildReminder(name, bills, amount, s.note);

    try {
      await sendEmail({ to: [s.email], cc: s.ccEmail ? [s.ccEmail] : undefined, subject, text, html });
      await prisma.$transaction([
        prisma.tallyPartyReminderSend.create({
          data: { reminderId: s.id, toEmail: s.email, amount, billCount: bills.length, ok: true },
        }),
        prisma.tallyPartyReminder.update({
          where: { id: s.id },
          data: { lastSentAt: today, sentCount: { increment: 1 } },
        }),
      ]);
      res.sent++;
    } catch (err) {
      res.failed++;
      await prisma.tallyPartyReminderSend.create({
        data: {
          reminderId: s.id, toEmail: s.email, amount, billCount: bills.length,
          ok: false, error: err instanceof Error ? err.message.slice(0, 300) : 'send failed',
        },
      }).catch(() => undefined);
    }
  }

  return res;
}

/**
 * The message itself.
 *
 * Written to be firm but not rude — most late payment is disorganisation, not
 * bad faith, and a reminder that reads like a threat costs more than it
 * collects. It states the facts, lists the bills, and asks.
 */
export function buildReminder(
  party: string,
  bills: Array<{ reference: string; dueDate: string | null; outstanding: number; daysOverdue: number }>,
  total: number,
  note?: string | null,
): { subject: string; text: string; html: string } {
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const worst = Math.max(...bills.map((b) => b.daysOverdue));

  const subject = bills.length === 1
    ? `Payment reminder — ${bills[0]!.reference} (${inr(total)})`
    : `Payment reminder — ${bills.length} outstanding bills (${inr(total)})`;

  const lines = bills.map((b) =>
    `  • ${b.reference} — ${inr(b.outstanding)}${b.dueDate ? `, due ${b.dueDate}` : ''}${b.daysOverdue > 0 ? ` (${b.daysOverdue} days ago)` : ''}`,
  );

  const text = [
    `Dear ${party},`,
    '',
    note ? `${note}\n` : '',
    `Our records show ${inr(total)} outstanding${worst > 0 ? `, the oldest ${worst} days past due` : ''}:`,
    '',
    ...lines,
    '',
    'If payment is already on its way, please ignore this note — and do let us know the reference so we can match it.',
    'If any of these figures look wrong, please reply and we will check them.',
    '',
    'Thank you,',
    'Accounts, Ameya Heights',
  ].filter((l) => l !== '').join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;max-width:560px">
      <p>Dear ${escapeHtml(party)},</p>
      ${note ? `<p>${escapeHtml(note)}</p>` : ''}
      <p>Our records show <strong>${inr(total)}</strong> outstanding${worst > 0 ? `, the oldest <strong>${worst} days</strong> past due` : ''}:</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0">
        <thead>
          <tr style="text-align:left;background:#f3f4f6">
            <th style="padding:6px 8px;border:1px solid #e5e7eb">Bill</th>
            <th style="padding:6px 8px;border:1px solid #e5e7eb">Due</th>
            <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${bills.map((b) => `
            <tr>
              <td style="padding:6px 8px;border:1px solid #e5e7eb">${escapeHtml(b.reference)}</td>
              <td style="padding:6px 8px;border:1px solid #e5e7eb">${b.dueDate ?? '—'}${b.daysOverdue > 0 ? ` <span style="color:#b91c1c">(${b.daysOverdue}d ago)</span>` : ''}</td>
              <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right">${inr(b.outstanding)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <p style="color:#4b5563">If payment is already on its way, please ignore this note — and do let us know the reference so we can match it. If any of these figures look wrong, please reply and we will check them.</p>
      <p>Thank you,<br/>Accounts, Ameya Heights</p>
    </div>`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

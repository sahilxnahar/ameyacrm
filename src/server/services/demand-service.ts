import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { sendWhatsappText, toWaNumber } from '@/server/services/whatsapp-service';
import { sendEmail } from '@/lib/email/email';
import { formatCurrency } from '@/lib/utils/format';
import { classifyDemandKind, endOfDay, addDays, DEMAND_UPCOMING_WINDOW_DAYS } from '@/lib/finance/demand-window';

/**
 * Payment demand & dunning (module #4). Turns due/overdue PaymentMilestone rows
 * into dispatched DemandNotice reminders — idempotent generation + out-of-band
 * dispatch over the existing WhatsApp (OpenWA) and email channels. The money
 * spine never moves here: a demand only *asks*; collection still lands on
 * PaymentMilestone → Voucher (via the Razorpay worker or a manual receipt).
 */

async function nextDemandNumber(): Promise<string> {
  const last = await prisma.demandNotice.findFirst({ where: { number: { startsWith: 'DL-' } }, orderBy: { number: 'desc' }, select: { number: true } });
  const seq = (last ? Number(last.number.split('-')[1] ?? '1000') : 1000) + 1;
  return `DL-${Number.isFinite(seq) ? seq : 1001}`;
}

export interface GenerateResult { overdue: number; upcoming: number; created: number }

/**
 * Scan open milestones and create a demand for each that is overdue or falling
 * due within the window. `@@unique([milestoneId, kind])` makes this safe to run
 * every day — a second run for the same milestone/kind is skipped, not doubled.
 */
export async function generateDemandNotices(now = new Date()): Promise<GenerateResult> {
  let milestones;
  try {
    milestones = await prisma.paymentMilestone.findMany({
      where: { status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] }, dueDate: { not: null, lte: endOfDay(addDays(now, DEMAND_UPCOMING_WINDOW_DAYS)) } },
      select: { id: true, bookingId: true, label: true, amount: true, dueDate: true },
      take: 500,
    });
  } catch {
    return { overdue: 0, upcoming: 0, created: 0 };
  }
  let overdue = 0, upcoming = 0, created = 0;
  for (const m of milestones) {
    if (!m.dueDate) continue;
    const kind = classifyDemandKind(m.dueDate, now);
    if (kind === 'OVERDUE') overdue++; else upcoming++;
    const exists = await prisma.demandNotice.findUnique({ where: { milestoneId_kind: { milestoneId: m.id, kind } }, select: { id: true } }).catch(() => null);
    if (exists) continue;
    try {
      await prisma.demandNotice.create({
        data: {
          number: await nextDemandNumber(), bookingId: m.bookingId, milestoneId: m.id, kind,
          amount: m.amount, dueDate: m.dueDate, label: m.label, status: 'PENDING',
        },
      });
      created++;
    } catch { /* unique race — another run got it; fine */ }
  }
  return { overdue, upcoming, created };
}

function demandMessage(name: string, label: string, amount: string, kind: string, due: Date | null): string {
  const when = due ? due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'the agreed date';
  const lead = kind === 'OVERDUE'
    ? `This is a reminder that your payment towards *${label}* of *${amount}* was due on ${when} and is now overdue.`
    : `This is a gentle reminder that your payment towards *${label}* of *${amount}* falls due on ${when}.`;
  return `Dear ${name},\n\n${lead}\n\nKindly arrange the payment at your earliest convenience. For any assistance, please reach out to our accounts team.\n\n— Ameya Heights`;
}

export interface DispatchResult { dispatched: number; failed: number; skipped: number }

/** Deliver PENDING demands over WhatsApp + email. Records what actually sent. */
export async function dispatchPendingDemands(limit = 100): Promise<DispatchResult> {
  let pending;
  try {
    pending = await prisma.demandNotice.findMany({
      where: { status: 'PENDING' }, take: limit, orderBy: { createdAt: 'asc' },
      include: { booking: { select: { lead: { select: { name: true, phone: true, email: true } } } } },
    });
  } catch {
    return { dispatched: 0, failed: 0, skipped: 0 };
  }
  let dispatched = 0, failed = 0, skipped = 0;
  for (const d of pending) {
    const lead = d.booking.lead;
    const name = lead?.name ?? 'Customer';
    const amount = formatCurrency(Number(d.amount));
    const message = demandMessage(name, d.label, amount, d.kind, d.dueDate);
    const sent: string[] = [];
    let lastError: string | null = null;

    const wa = lead?.phone ? toWaNumber(lead.phone) : null;
    if (wa) {
      const r = await sendWhatsappText(wa, message).catch((e) => ({ ok: false, error: e instanceof Error ? e.message : 'whatsapp error' }));
      if (r.ok) sent.push('whatsapp'); else lastError = r.error ?? 'whatsapp failed';
    }
    if (lead?.email) {
      const r = await sendEmail({ to: [lead.email], subject: `Payment reminder — ${d.label} (${amount})`, text: message }).catch((e) => ({ ok: false, error: e instanceof Error ? e.message : 'email error' }));
      if (r.ok) sent.push('email'); else lastError = lastError ?? r.error ?? 'email failed';
    }

    if (sent.length) {
      await prisma.demandNotice.update({ where: { id: d.id }, data: { status: 'SENT', sentVia: sent.join(','), sentAt: new Date(), reminderCount: { increment: 1 }, lastError: null } }).catch(() => undefined);
      dispatched++;
      await writeAudit({ action: 'UPDATE', entityType: 'DemandNotice', entityId: d.id, summary: `Demand ${d.number} sent via ${sent.join(', ')} (${amount})` });
    } else if (!wa && !lead?.email) {
      // No contact channel — park it so a human can chase, don't burn retries.
      await prisma.demandNotice.update({ where: { id: d.id }, data: { lastError: 'no phone or email on the buyer' } }).catch(() => undefined);
      skipped++;
    } else {
      await prisma.demandNotice.update({ where: { id: d.id }, data: { reminderCount: { increment: 1 }, lastError: (lastError ?? 'dispatch failed').slice(0, 300) } }).catch(() => undefined);
      failed++;
    }
  }
  return { dispatched, failed, skipped };
}

/** Money convergence: once the milestone is paid, close its demands. */
export async function reconcileDemandPayments(): Promise<{ closed: number }> {
  try {
    const paid = await prisma.demandNotice.updateMany({
      where: { status: { in: ['PENDING', 'SENT'] }, milestone: { status: 'PAID' } },
      data: { status: 'PAID' },
    });
    return { closed: paid.count };
  } catch {
    return { closed: 0 };
  }
}

export interface DemandRun extends GenerateResult, DispatchResult { closed: number }

/** One full pass: reconcile paid → generate new → dispatch pending. */
export async function runDemandCycle(): Promise<DemandRun> {
  const { closed } = await reconcileDemandPayments();
  const gen = await generateDemandNotices();
  const disp = await dispatchPendingDemands();
  return { ...gen, ...disp, closed };
}

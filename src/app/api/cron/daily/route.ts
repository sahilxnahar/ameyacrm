import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { notify } from '@/lib/notifications/notify';
import { putObject } from '@/lib/storage/storage';
import { releaseExpiredHolds } from '@/lib/inventory/auto-release';
import { writeAudit } from '@/lib/audit/log';
import { getBriefing } from '@/server/services/briefing-service';
import { runOverdueEscalation } from '@/server/services/escalation-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * ONE daily maintenance pass — Vercel Hobby allows only once-per-day crons,
 * so every scheduled job runs here in sequence. Each step is isolated: a failure
 * in one never stops the others.
 */
export async function GET(req: NextRequest) {
  const secret = env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  const key = req.nextUrl.searchParams.get('key');
  if (secret && auth !== `Bearer ${secret}` && key !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const now = new Date();
  const result: Record<string, unknown> = { at: now.toISOString() };

  // 1) release expired unit holds
  try { result.unitsReleased = await releaseExpiredHolds(); } catch { result.unitsReleased = 'failed'; }

  // 2) flag overdue payments, accrue interest, nudge reps
  try {
    const flagged = await prisma.paymentMilestone.updateMany({ where: { status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: now } }, data: { status: 'OVERDUE' } });
    const rate = Number((await prisma.setting.findUnique({ where: { key: 'collections.interestPct' } }))?.value ?? 18) || 18;
    const overdue = await prisma.paymentMilestone.findMany({ where: { status: 'OVERDUE' }, include: { booking: { select: { salesRepId: true } } }, take: 1000 });
    const byRep = new Map<string, { count: number; amount: number; interest: number }>();
    for (const m of overdue) {
      const days = m.dueDate ? Math.max(0, Math.floor((now.getTime() - m.dueDate.getTime()) / 86400000)) : 0;
      const interest = Number(m.amount) * (rate / 100) * (days / 365);
      const rep = m.booking?.salesRepId;
      if (rep) { const e = byRep.get(rep) ?? { count: 0, amount: 0, interest: 0 }; e.count++; e.amount += Number(m.amount); e.interest += interest; byRep.set(rep, e); }
    }
    const fmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
    for (const [rep, e] of byRep) {
      await notify({ userId: rep, type: 'SYSTEM', title: `${e.count} overdue payment(s) need follow-up`, body: `Rs.${fmt.format(e.amount)} overdue · ~Rs.${fmt.format(e.interest)} interest at ${rate}% p.a.`, link: '/billing' });
    }
    result.paymentsFlagged = flagged.count; result.repsNotified = byRep.size;
  } catch { result.payments = 'failed'; }

  // 3) fire due reminders
  try {
    const due = await prisma.reminder.findMany({ where: { status: 'PENDING', notifiedAt: null, dueAt: { lte: now } }, take: 500 });
    let sent = 0;
    for (const r of due) {
      try {
        await notify({ userId: r.userId, type: 'SYSTEM', title: `Reminder: ${r.title}`, body: r.notes ?? undefined, link: r.leadId ? `/sales/${r.leadId}` : '/reminders' });
        await prisma.reminder.update({ where: { id: r.id }, data: { notifiedAt: new Date() } });
        sent++;
      } catch { /* continue */ }
    }
    result.remindersSent = sent;
  } catch { result.reminders = 'failed'; }

  // 4) nightly backup snapshot
  try {
    const [users, projects, units, leads, bookings, payments, customers, partners, invoices] = await Promise.all([
      prisma.user.findMany({ select: { id: true, name: true, username: true, email: true, role: true, status: true, createdAt: true } }),
      prisma.project.findMany(), prisma.unit.findMany(), prisma.lead.findMany({ where: { deletedAt: null } }),
      prisma.booking.findMany(), prisma.paymentMilestone.findMany(),
      prisma.customer.findMany({ select: { id: true, name: true, email: true, phone: true, bookingId: true, isActive: true } }),
      prisma.channelPartner.findMany(), prisma.invoice.findMany({ include: { items: true } }),
    ]);
    const body = Buffer.from(JSON.stringify({ exportedAt: now.toISOString(), users, projects, units, leads, bookings, payments, customers, partners, invoices }), 'utf8');
    const stamp = now.toISOString().slice(0, 10);
    const stored = await putObject(`backups/ameya-crm-backup-${stamp}.json`, body, 'application/json');
    result.backup = { key: stored.key, sizeKb: Math.round(body.length / 1024) };
    await writeAudit({ action: 'EXPORT', entityType: 'Backup', summary: `Automated daily backup ${stamp}` });
  } catch { result.backup = 'failed'; }

  // 5) regenerate the AI daily briefing
  try { const b = await getBriefing(true); result.briefing = b.cached ? 'generated' : 'skipped'; } catch { result.briefing = 'failed'; }

  return NextResponse.json({ ok: true, ...result });
}

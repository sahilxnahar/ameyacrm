import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { notify } from '@/lib/notifications/notify';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Daily: flag overdue milestones, accrue interest, and nudge the responsible sales reps.
 *  Auth: `Authorization: Bearer <CRON_SECRET>` or `?key=<CRON_SECRET>`. */
export async function GET(req: NextRequest) {
  const secret = env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  const key = req.nextUrl.searchParams.get('key');
  if (secret && auth !== `Bearer ${secret}` && key !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const now = new Date();
  const flagged = await prisma.paymentMilestone.updateMany({ where: { status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: now } }, data: { status: 'OVERDUE' } });

  const rate = Number((await prisma.setting.findUnique({ where: { key: 'collections.interestPct' } }))?.value ?? 18) || 18; // annual %
  const overdue = await prisma.paymentMilestone.findMany({ where: { status: 'OVERDUE' }, include: { booking: { select: { reference: true, salesRepId: true } } }, take: 1000 });

  let totalInterest = 0;
  const byRep = new Map<string, { count: number; amount: number; interest: number }>();
  for (const m of overdue) {
    const days = m.dueDate ? Math.max(0, Math.floor((now.getTime() - m.dueDate.getTime()) / 86400000)) : 0;
    const interest = Number(m.amount) * (rate / 100) * (days / 365);
    totalInterest += interest;
    const rep = m.booking?.salesRepId;
    if (rep) { const e = byRep.get(rep) ?? { count: 0, amount: 0, interest: 0 }; e.count++; e.amount += Number(m.amount); e.interest += interest; byRep.set(rep, e); }
  }
  const fmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  for (const [rep, e] of byRep) {
    await notify({ userId: rep, type: 'SYSTEM', title: `${e.count} overdue payment(s) need follow-up`, body: `Rs.${fmt.format(e.amount)} overdue · ~Rs.${fmt.format(e.interest)} interest accrued at ${rate}% p.a.`, link: '/billing' });
  }
  return NextResponse.json({ ok: true, flaggedOverdue: flagged.count, overdueCount: overdue.length, interestAccrued: Math.round(totalInterest), ratePct: rate, at: now.toISOString() });
}

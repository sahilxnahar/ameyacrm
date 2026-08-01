import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { notifyMany } from '@/lib/notifications/notify';
import { writeAudit } from '@/lib/audit/log';
import { openConfig } from '@/server/services/connector-runtime';
import { verifyRazorpaySignature, extractRazorpayPayment } from '@/lib/connectors/razorpay';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Razorpay webhook receiver. Verifies the signature with the connector's stored
 * webhook secret, then on a captured payment tries to reconcile it against a
 * booking's payment milestone (matched by the notes we set, or by amount).
 * Unmatched payments are logged and finance is notified rather than guessed at.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature') || '';

  const install = await prisma.connectorInstall.findUnique({ where: { slug: 'razorpay' } }).catch(() => null);
  if (!install || install.status !== 'INSTALLED') return NextResponse.json({ error: 'razorpay not installed' }, { status: 404 });
  const cfg = openConfig(install.config as Record<string, unknown> | null);
  const secret = String(cfg.webhookSecret ?? '');
  if (!verifyRazorpaySignature(raw, signature, secret)) return NextResponse.json({ error: 'invalid signature' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = JSON.parse(raw) as Record<string, unknown>; } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const event = String(body.event ?? '');
  if (event !== 'payment.captured' && event !== 'order.paid') return NextResponse.json({ ok: true, ignored: event });

  const pay = extractRazorpayPayment(body);
  if (!pay) return NextResponse.json({ ok: true, ignored: 'no payment entity' });

  const rupees = Math.round(pay.amount / 100);
  const notes = pay.notes ?? {};

  // 1) Best match: a milestone id we put in the payment notes.
  let milestone = notes.milestoneId
    ? await prisma.paymentMilestone.findUnique({ where: { id: String(notes.milestoneId) } }).catch(() => null)
    : null;

  // 2) Else: a booking id in the notes → its earliest unpaid milestone that this
  //    payment could actually settle. Matching on the amount matters: a buyer
  //    paying a small token would otherwise be matched to the earliest open
  //    instalment, which may be many times larger.
  if (!milestone && notes.bookingId) {
    const open = await prisma.paymentMilestone.findMany({
      where: { bookingId: String(notes.bookingId), status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      orderBy: { dueDate: 'asc' },
    }).catch(() => []);
    // Prefer an exact amount match, then fall back to the earliest open one.
    milestone = open.find((m) => Math.round(Number(m.amount)) === rupees) ?? open[0] ?? null;
  }

  if (milestone && milestone.status !== 'PAID') {
    // Only mark PAID when the money actually covers the instalment. A short
    // payment must stay open as PARTIAL, otherwise the demand/dunning engine
    // stops chasing the balance and the receivable silently disappears.
    const due = Math.round(Number(milestone.amount));
    const settled = rupees >= due;
    await prisma.paymentMilestone.update({
      where: { id: milestone.id },
      data: settled ? { status: 'PAID', paidAt: new Date() } : { status: 'PARTIAL' },
    });
    await writeAudit({
      action: 'UPDATE', entityType: 'PaymentMilestone', entityId: milestone.id,
      summary: settled
        ? `Razorpay ${pay.id}: ₹${rupees} reconciled to "${milestone.label}" (settled in full)`
        : `Razorpay ${pay.id}: ₹${rupees} part-payment against "${milestone.label}" (₹${due} due) — balance ₹${due - rupees} still open`,
    });
    if (!settled) {
      // A part payment needs a human to chase the rest — say so explicitly.
      const fin = await prisma.user.findMany({ where: { status: 'ACTIVE', deletedAt: null, role: { in: ['SUPER_ADMIN', 'ADMIN'] } }, select: { id: true }, take: 10 });
      await notifyMany(fin.map((a) => a.id), {
        type: 'SYSTEM',
        title: `Part payment received — ₹${rupees} of ₹${due}`,
        body: `"${milestone.label}" is short by ₹${due - rupees}. The milestone remains open.`,
        link: '/billing',
      }).catch(() => undefined);
    }
    return NextResponse.json({ ok: true, reconciled: milestone.id, settled });
  }

  // Unmatched — record it and tell finance, never guess.
  const admins = await prisma.user.findMany({ where: { status: 'ACTIVE', deletedAt: null, role: { in: ['SUPER_ADMIN', 'ADMIN'] } }, select: { id: true }, take: 10 });
  await notifyMany(admins.map((a) => a.id), {
    type: 'SYSTEM',
    title: `Razorpay payment received — ₹${rupees}`,
    body: `Payment ${pay.id}${pay.contact ? ` from ${pay.contact}` : ''} needs matching to a booking.`,
    link: '/billing',
  }).catch(() => undefined);
  await writeAudit({ action: 'CREATE', entityType: 'Payment', summary: `Razorpay ${pay.id}: ₹${rupees} received, unmatched` });
  return NextResponse.json({ ok: true, reconciled: null, notified: admins.length });
}

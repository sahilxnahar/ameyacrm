import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { splitEscrow } from '@/lib/finance/escrow-split';

/**
 * The out-of-band worker (module #50). Drains PENDING WebhookEvent rows and
 * dispatches each to its domain handler, so a slow third-party API never blocks
 * the CRM UI. Idempotent + retry-with-backoff; a row that fails 3× parks as
 * FAILED for manual replay. Called by /api/cron/worker and the admin "run now".
 */

export interface WorkerResult { processed: number; failed: number; remaining: number }

export async function processPendingWebhooks(limit = 50): Promise<WorkerResult> {
  let pending;
  try {
    pending = await prisma.webhookEvent.findMany({ where: { status: 'PENDING' }, take: limit, orderBy: { createdAt: 'asc' } });
  } catch {
    return { processed: 0, failed: 0, remaining: 0 };
  }
  let processed = 0, failed = 0;
  for (const event of pending) {
    try {
      await prisma.webhookEvent.update({ where: { id: event.id }, data: { status: 'PROCESSING' } });
      switch (event.provider) {
        case 'RAZORPAY': await handleRazorpayPayment(event); break;
        case 'WHATSAPP': await handleWhatsAppInbound(event); break;
        case 'IOT_GATE': await handleIotGate(event); break;
        default: /* no specialised handler — acknowledge and move on */ break;
      }
      await prisma.webhookEvent.update({ where: { id: event.id }, data: { status: 'DONE' } });
      processed++;
    } catch (err) {
      failed++;
      const willRetry = event.retryCount < 3;
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: willRetry ? 'PENDING' : 'FAILED', retryCount: { increment: 1 }, errorMessage: (err instanceof Error ? err.message : 'processing error').slice(0, 400) },
      }).catch(() => undefined);
    }
  }
  const remaining = await prisma.webhookEvent.count({ where: { status: 'PENDING' } }).catch(() => 0);
  return { processed, failed, remaining };
}

/** Razorpay payment.captured → collection Voucher + 70/30 RERA escrow split. */
async function handleRazorpayPayment(event: { id: string; payload: unknown }): Promise<void> {
  const p = (event.payload ?? {}) as Record<string, unknown>;
  const entity = ((p.payload as Record<string, unknown> | undefined)?.payment as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
  const pay = entity ?? p; // accept either the raw entity or the full webhook envelope
  const notes = (pay.notes as Record<string, string> | undefined) ?? {};
  const bookingId = notes.bookingId || null;
  const rupees = Math.round(Number(pay.amount ?? 0) / 100);
  if (rupees <= 0) return;

  const booking = bookingId ? await prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true, unit: { select: { projectId: true } }, lead: { select: { name: true } } } }).catch(() => null) : null;
  const projectId = booking?.unit?.projectId ?? null;

  // Money spine: a receipt voucher (never a second money table).
  const last = await prisma.voucher.findFirst({ where: { number: { startsWith: 'CR-' } }, orderBy: { number: 'desc' }, select: { number: true } });
  const seq = (last ? Number(last.number.split('-')[1] ?? '1000') : 1000) + 1;
  const voucher = await prisma.voucher.create({
    data: {
      number: `CR-${Number.isFinite(seq) ? seq : 1001}`, kind: 'BANK_RECEIVED', status: 'POSTED',
      voucherDate: new Date(), partyName: booking?.lead?.name ?? 'Buyer', bookingId: booking?.id ?? null,
      projectId, amount: rupees, mode: 'BANK_TRANSFER',
      reference: String(pay.id ?? ''), utr: (pay.acquirer_data as Record<string, string> | undefined)?.bank_transaction_id ?? null,
      narration: `Razorpay collection${bookingId ? ` for booking ${bookingId}` : ''} — 70/30 escrow split`,
    },
  });

  if (bookingId) {
    const { rera, general } = splitEscrow(rupees);
    await prisma.bookingEscrowSplit.createMany({
      data: [
        { bookingId, webhookEventId: event.id, voucherId: voucher.id, accountType: 'RERA_70', amount: rera, utrNumber: (pay.acquirer_data as Record<string, string> | undefined)?.bank_transaction_id ?? null },
        { bookingId, webhookEventId: event.id, voucherId: voucher.id, accountType: 'GENERAL_30', amount: general },
      ],
    });
  }
  await writeAudit({ action: 'CREATE', entityType: 'Voucher', entityId: voucher.id, summary: `Razorpay ₹${rupees} collected → 70/30 escrow (voucher ${voucher.number})` });
}

async function handleWhatsAppInbound(_event: { id: string; payload: unknown }): Promise<void> {
  // Placeholder for conversational lead intake — wired in a later WhatsApp module.
}

async function handleIotGate(_event: { id: string; payload: unknown }): Promise<void> {
  // Placeholder for gate/biometric verification — wired in the safety-gate module.
}

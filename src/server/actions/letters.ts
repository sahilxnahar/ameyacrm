'use server';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';
import { buildLetterPdf, type LetterLine } from '@/lib/pdf/letters-pdf';
import { computeDemandTax } from '@/lib/sales/tax';

/** Read a numeric setting, falling back to a default. */
async function numSetting(key: string, fallback: number): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key } });
  const n = Number(row?.value ?? fallback);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

type LetterResult = { ok: true; filename: string; pdfBase64: string } | { error: string };

/** Generate a demand notice or allotment letter (mail-merge) for a booking. */
export async function generateBookingLetter(bookingId: string, kind: 'DEMAND' | 'ALLOTMENT'): Promise<LetterResult> {
  try {
    const ctx = await ensure('booking.manage');
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { lead: { select: { name: true } }, unit: { include: { project: true } }, payments: { orderBy: [{ dueDate: 'asc' }] } },
    });
    if (!booking) return { error: 'Booking not found.' };
    const buyerName = booking.lead?.name ?? 'Valued Customer';
    const due = booking.payments.filter((p) => p.status !== 'PAID');
    const lines: LetterLine[] = (kind === 'DEMAND' ? due : booking.payments).map((p) => ({
      label: p.label, amount: Number(p.amount), due: p.dueDate ? p.dueDate.toLocaleDateString('en-IN') : null, status: kind === 'DEMAND' ? p.status : null,
    }));
    if (kind === 'DEMAND' && lines.length === 0) return { error: 'No pending dues on this booking.' };

    // Auto GST + TDS (194-IA) on a demand, from the company's configured rates.
    const amountDue = lines.reduce((s, l) => s + l.amount, 0);
    const agreementValue = booking.agreementValue ? Number(booking.agreementValue) : null;
    const tax = kind === 'DEMAND'
      ? computeDemandTax(amountDue, agreementValue, {
          gstPct: await numSetting('tax.gstPct', 5),
          tdsPct: await numSetting('tax.tds194iaPct', 1),
          tdsThreshold: await numSetting('tax.tds194iaThreshold', 5000000),
        })
      : null;

    const bytes = await buildLetterPdf({
      kind, company: { name: 'Ameya Heights', tagline: 'Premium Residences, Bengaluru', reraNote: booking.unit?.project?.reraNumber ? `RERA: ${booking.unit.project.reraNumber}` : '' },
      date: new Date(), buyerName, reference: booking.reference,
      unit: booking.unit?.code ?? '—', project: booking.unit?.project?.name ?? '—', typology: booking.unit?.typology ?? null,
      area: booking.unit?.carpetAreaSqft ? Number(booking.unit.carpetAreaSqft) : null,
      agreementValue,
      lines, amountDue: kind === 'DEMAND' ? amountDue : undefined, payByDays: 15, tax,
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Booking', entityId: bookingId, summary: `Generated ${kind === 'DEMAND' ? 'demand notice' : 'allotment letter'} for ${booking.reference}` });
    return { ok: true, filename: `${kind === 'DEMAND' ? 'Demand' : 'Allotment'}-${booking.reference}.pdf`, pdfBase64: Buffer.from(bytes).toString('base64') };
  } catch (err) { return toActionError(err); }
}

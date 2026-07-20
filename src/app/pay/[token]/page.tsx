import type { Metadata } from 'next';
import { IndianRupee, CheckCircle2, FileText } from 'lucide-react';
import { prisma } from '@/lib/db/prisma';
import { ConfirmPayment } from '@/components/payments/confirm-payment';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Payment request · Ameya Heights', robots: { index: false } };

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const pr = await prisma.paymentRequest.findUnique({ where: { token } });

  if (!pr || pr.status === 'CANCELLED') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-brass">Ameya Heights</h1>
        <p className="mt-3 text-sm text-muted-foreground">This payment link is invalid or has been cancelled. Please contact our accounts desk.</p>
      </main>
    );
  }
  if (pr.status === 'PENDING') {
    await prisma.paymentRequest.update({ where: { id: pr.id }, data: { status: 'VIEWED', viewedAt: new Date() } }).catch(() => undefined);
  }
  const instructions = String((await prisma.setting.findUnique({ where: { key: 'payments.instructions' } }))?.value ?? '');
  const settled = pr.status === 'PAID';
  const confirmed = pr.status === 'CONFIRMED';

  return (
    <main
      className="min-h-screen w-full"
      style={{ background: 'linear-gradient(125deg, #04123A 0%, #0A2A6B 20%, #12409E 40%, #1E5FD6 58%, #B9CFEF 82%, #F7F3EA 100%)' }}
    >
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-12">
        <div className="mb-5 text-center">
          <h1 className="font-display text-3xl font-semibold" style={{ color: '#F0D9A0' }}>Ameya Heights</h1>
          <p className="text-xs text-white/70">Payment request</p>
        </div>

        <div className="rounded-2xl border border-black/10 bg-[#FCFAF5]/95 p-6 shadow-[0_24px_70px_-20px_rgba(4,18,58,0.55)] sm:p-8" style={{ color: '#14120E' }}>
          <p className="font-mono text-xs text-[#7A7365]">{pr.reference}</p>
          <p className="mt-3 text-sm text-[#5E584C]">
            <span className="font-medium text-[#14120E]">{pr.requestedByName ?? 'Ameya Heights LLP'}</span> has requested a payment from{' '}
            <span className="font-medium text-[#14120E]">{pr.payeeName}</span> towards:
          </p>
          <p className="mt-2 rounded-md bg-[#F1ECE0] p-3 text-sm">{pr.description}</p>

          <div className="mt-5 flex items-baseline gap-2 border-y py-4">
            <IndianRupee className="h-6 w-6 text-[#8C6E2C]" />
            <span className="font-display text-4xl font-semibold">{inr.format(Number(pr.amount))}</span>
          </div>

          {pr.dueDate && <p className="mt-3 text-sm text-[#5E584C]">Due by <b>{pr.dueDate.toLocaleDateString('en-IN')}</b></p>}

          {settled ? (
            <div className="mt-5 flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> This payment has been received. Thank you.
            </div>
          ) : confirmed ? (
            <div className="mt-5 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              Payment marked as sent{pr.payerReference ? ` (ref ${pr.payerReference})` : ''}. Our accounts team is verifying it.
            </div>
          ) : (
            <>
              {instructions && (
                <div className="mt-5">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#7A7365]"><FileText className="h-3.5 w-3.5" /> Pay to</p>
                  <pre className="whitespace-pre-wrap rounded-md bg-[#F1ECE0] p-3 font-sans text-sm">{instructions}</pre>
                </div>
              )}
              <div className="mt-5"><ConfirmPayment token={token} /></div>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-[11px] text-[#1B2F55]/60">Ameya Heights LLP · ameyaheights.com</p>
      </div>
    </main>
  );
}

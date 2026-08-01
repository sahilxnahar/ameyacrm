import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { prisma } from '@/lib/db/prisma';
import { borrowingBook, bankPositions, cashForecast } from '@/server/services/treasury-service';
import { summariseBorrowings } from '@/lib/treasury/borrowing-interest';
import { AlertTriangle } from 'lucide-react';

export const metadata: Metadata = { title: 'Finance command center' };
export const dynamic = 'force-dynamic';

const inr = (n: number) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))}`;

export default async function FinancePage() {
  await requirePermission('treasury.view');
  const now = new Date();

  const [rows, positions, forecast, overdue, pending, bills] = await Promise.all([
    borrowingBook(now),
    bankPositions(),
    cashForecast(now),
    prisma.paymentMilestone.aggregate({ where: { status: 'OVERDUE' }, _sum: { amount: true }, _count: true }).catch(() => ({ _sum: { amount: null }, _count: 0 })),
    prisma.paymentMilestone.aggregate({ where: { status: { in: ['PENDING', 'PARTIAL'] } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: null } })),
    prisma.vendorBill.aggregate({ where: { status: { notIn: ['PAID', 'VOID'] } }, _sum: { amount: true }, _count: true }).catch(() => ({ _sum: { amount: null }, _count: 0 })),
  ]);

  const debt = summariseBorrowings(rows.map((r) => ({ outstanding: r.outstanding, interestAccrued: r.interestAccrued, interestPaid: r.interestPaid, interestRate: r.interestRate })));
  const cash = positions.reduce((s, p) => s + p.position, 0);
  const overdueRecv = Number(overdue._sum.amount ?? 0);
  const pendingRecv = Number(pending._sum.amount ?? 0);
  const payables = Number(bills._sum.amount ?? 0);
  const lowNegative = forecast.lowestPoint < 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Finance command center" description="Your money at a glance — cost of capital, cash position, what's owed to you and by you, and a 12-week cash runway." />

      {/* Cost of capital */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Cost of capital (bank &amp; NBFC debt)</h2>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
          <Tile label="Debt outstanding" value={inr(debt.totalOutstanding)} hint="Principal still owed" />
          <Tile label="Weighted avg rate" value={`${debt.weightedAvgRate.toFixed(2)}%`} hint="Per year, balance-weighted" />
          <Tile label="Interest / month" value={inr(debt.monthlyInterestRunRate)} hint="At current balances" />
          <Tile label="Interest due" value={inr(debt.totalNetInterestDue)} hint="Accrued, not yet paid" />
        </div>
      </section>

      {/* Cash & working capital */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Cash &amp; working capital</h2>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
          <Tile label="Cash in bank" value={inr(cash)} hint={`${positions.length} account${positions.length === 1 ? '' : 's'}`} />
          <Tile label="Overdue to collect" value={inr(overdueRecv)} hint={`${overdue._count} milestone${overdue._count === 1 ? '' : 's'}`} tone={overdueRecv > 0 ? 'warn' : undefined} />
          <Tile label="Upcoming receivables" value={inr(pendingRecv)} hint="Not yet due" />
          <Tile label="Unpaid bills" value={inr(payables)} hint={`${bills._count} bill${bills._count === 1 ? '' : 's'} owing`} />
        </div>
      </section>

      {/* Cash runway */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">12-week cash runway</h2>
        {lowNegative && (
          <div className="mb-3 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Cash is forecast to go <strong>negative</strong> (low point {inr(forecast.lowestPoint)} in week {forecast.lowestWeekIndex + 1}). Bring collections forward or delay a payment run.</p>
          </div>
        )}
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
          <Tile label="Opening cash" value={inr(forecast.opening)} hint="Today" />
          <Tile label="Lowest point" value={inr(forecast.lowestPoint)} hint={`Week ${forecast.lowestWeekIndex + 1}`} tone={lowNegative ? 'bad' : undefined} />
          <Tile label="Closing (12 weeks)" value={inr(forecast.closing)} hint={forecast.horizonNote} />
        </div>

        <Card className="mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Week of</th>
                  <th className="px-3 py-2 text-right">Money in</th>
                  <th className="px-3 py-2 text-right">Money out</th>
                  <th className="px-3 py-2 text-right">Closing</th>
                </tr>
              </thead>
              <tbody>
                {forecast.buckets.map((b) => (
                  <tr key={b.index} className="border-b last:border-0">
                    <td className="px-3 py-1.5">{new Date(b.weekStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{b.inflow ? inr(b.inflow) : '—'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-rose-600 dark:text-rose-400">{b.outflow ? inr(b.outflow) : '—'}</td>
                    <td className={`px-3 py-1.5 text-right font-medium tabular-nums ${b.closing < 0 ? 'text-destructive' : ''}`}>{inr(b.closing)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'warn' | 'bad' }) {
  const valueTone = tone === 'bad' ? 'text-destructive' : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : '';
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueTone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

import type { Metadata } from 'next';
import { format } from 'date-fns';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { getForecast, getProbabilities } from '@/server/services/forecast-service';
import dynamic from 'next/dynamic';
const ForecastView = dynamic(() => import('@/components/forecast/forecast-view').then((m) => m.ForecastView), {
  loading: () => <div className="h-96 animate-pulse rounded-lg bg-secondary" />,
});

export const metadata: Metadata = { title: 'Forecast & Incentives' };
export const dynamic = 'force-dynamic';

export default async function ForecastPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const ctx = await requirePermission('report.view');
  const { m } = await searchParams;
  const period = m ? new Date(`${m}-01T00:00:00`) : new Date();

  const [fc, prob, slabs, entries, users] = await Promise.all([
    getForecast(period),
    getProbabilities(),
    prisma.incentiveSlab.findMany({ where: { isActive: true }, orderBy: { fromValue: 'asc' } }),
    prisma.incentiveEntry.findMany({
      where: { periodStart: { gte: new Date(period.getFullYear(), period.getMonth(), 1) } },
      orderBy: { createdAt: 'desc' }, take: 200,
    }),
    prisma.user.findMany({ where: { status: 'ACTIVE', deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  return (
    <div>
      <PageHeader
        title="Forecast & incentives"
        description="Targets against actuals, a weighted view of what is likely to close, and what each person has earned."
      />
      <ForecastView
        month={format(period, 'yyyy-MM')}
        rows={fc.rows}
        totals={fc.totals}
        byStage={fc.byStage}
        probabilities={prob}
        users={users}
        canManage={can(ctx.permissions, 'admin.setting.manage')}
        slabs={slabs.map((s) => ({
          id: s.id, name: s.name, fromValue: Number(s.fromValue),
          toValue: s.toValue === null ? null : Number(s.toValue),
          ratePercent: Number(s.ratePercent),
          flatAmount: s.flatAmount === null ? null : Number(s.flatAmount),
        }))}
        entries={entries.map((e) => ({
          id: e.id, userName: nameOf.get(e.userId) ?? '—', baseValue: Number(e.baseValue),
          amount: Number(e.amount), slabName: e.slabName, status: e.status, note: e.note,
        }))}
      />
    </div>
  );
}

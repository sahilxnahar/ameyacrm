import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { AnalyticsView } from '@/components/analytics/analytics-view';

export const metadata: Metadata = { title: 'Analytics' };

export default async function AnalyticsPage() {
  await requirePermission('report.view');
  const num = (v: unknown) => Number(v || 0);
  const [bySource, byStatus, byUnit, milestones, inv, bookings, leads, won] = await Promise.all([
    prisma.lead.groupBy({ by: ['source'], where: { deletedAt: null }, _count: true }),
    prisma.lead.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
    prisma.unit.groupBy({ by: ['status'], _count: true }),
    prisma.paymentMilestone.groupBy({ by: ['status'], _sum: { amount: true } }),
    prisma.invoice.aggregate({ _sum: { total: true, amountPaid: true } }),
    prisma.booking.count(),
    prisma.lead.count({ where: { deletedAt: null } }),
    prisma.lead.count({ where: { deletedAt: null, status: { in: ['BOOKED', 'WON'] } } }),
  ]);
  const milestonesPaid = num(milestones.find((m) => m.status === 'PAID')?._sum.amount);
  const milestonesTotal = milestones.reduce((s, m) => s + num(m._sum.amount), 0);
  return (
    <div>
      <PageHeader title="Executive analytics" description="Sales velocity, collections and inventory — live." />
      <AnalyticsView
        kpis={{ leads, bookings, won, conversion: leads ? Math.round((won / leads) * 100) : 0 }}
        sources={bySource.map((r) => ({ name: r.source, value: (r as { _count: number })._count }))}
        statuses={byStatus.map((r) => ({ name: r.status, value: (r as { _count: number })._count }))}
        inventory={byUnit.map((r) => ({ name: r.status, value: (r as { _count: number })._count }))}
        money={{ milestonesPaid, milestonesTotal, invoicePaid: num(inv._sum.amountPaid), invoiceTotal: num(inv._sum.total) }}
      />
    </div>
  );
}

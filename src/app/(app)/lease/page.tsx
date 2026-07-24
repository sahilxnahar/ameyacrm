import type { Metadata } from 'next';
import { KeyRound, CalendarClock, Wrench, Wallet } from 'lucide-react';
import { addDays } from 'date-fns';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
import { LeaseView } from '@/components/lease/lease-view';
import { formatCurrency } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Lease' };

export default async function LeasePage() {
  await requirePermission('lease.view');
  const now = new Date();
  const [leases, tenants, maintenance, units, users, activeCount, expiring, openMaint, rentAgg] = await Promise.all([
    prisma.lease.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { tenant: { select: { name: true } }, unit: { select: { code: true } }, project: { select: { name: true } } } }),
    prisma.tenant.findMany({ orderBy: { name: 'asc' }, take: 200, include: { _count: { select: { leases: true } } } }),
    prisma.maintenanceRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { assignedTo: { select: { name: true } }, lease: { select: { reference: true } } } }),
    prisma.unit.findMany({ select: { id: true, code: true } }),
    prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.lease.count({ where: { status: 'ACTIVE' } }),
    prisma.lease.count({ where: { status: { in: ['ACTIVE', 'EXPIRING'] }, endDate: { lte: addDays(now, 60) } } }),
    prisma.maintenanceRequest.count({ where: { status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
    prisma.lease.aggregate({ _sum: { rentAmount: true }, where: { status: 'ACTIVE' } }),
  ]);

  return (
    <div>
      <PageHeader title="Lease Management" description="Tenants, leases, rent schedules and maintenance." />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Active leases" value={activeCount} icon={KeyRound} />
        <StatCard label="Expiring ≤ 60 days" value={expiring} icon={CalendarClock} tone="warning" />
        <StatCard label="Open maintenance" value={openMaint} icon={Wrench} tone={openMaint ? 'destructive' : 'default'} />
        <StatCard label="Monthly rent roll" value={formatCurrency(Number(rentAgg._sum.rentAmount ?? 0))} icon={Wallet} tone="success" />
      </div>
      <LeaseView
        units={units.map((u) => ({ id: u.id, name: u.code }))}
        users={users}
        tenantOptions={tenants.map((t) => ({ id: t.id, name: t.name }))}
        leases={leases.map((l) => ({ id: l.id, reference: l.reference, tenant: l.tenant.name, unit: l.unit?.code ?? null, project: l.project?.name ?? null, status: l.status, rent: Number(l.rentAmount), startDate: l.startDate.toISOString(), endDate: l.endDate.toISOString() }))}
        tenants={tenants.map((t) => ({ id: t.id, name: t.name, email: t.email, phone: t.phone, company: t.company, leases: t._count.leases }))}
        maintenance={maintenance.map((m) => ({ id: m.id, reference: m.reference, title: m.title, priority: m.priority, status: m.status, assignedTo: m.assignedTo?.name ?? null, lease: m.lease?.reference ?? null }))}
      />
    </div>
  );
}

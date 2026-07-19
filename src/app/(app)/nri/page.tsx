import type { Metadata } from 'next';
import { Globe2, CalendarClock, Users2, Trophy } from 'lucide-react';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
import { NriDesk } from '@/components/nri/nri-desk';

export const metadata: Metadata = { title: 'NRI Desk' };

export default async function NriPage() {
  await requirePermission('lead.view');
  const now = new Date();
  const [leads, total, countries, dueSoon, won] = await Promise.all([
    prisma.lead.findMany({ where: { deletedAt: null, isNri: true }, orderBy: [{ nextFollowUp: 'asc' }, { updatedAt: 'desc' }], take: 200, include: { owner: { select: { name: true } } } }),
    prisma.lead.count({ where: { deletedAt: null, isNri: true } }),
    prisma.lead.findMany({ where: { deletedAt: null, isNri: true, country: { not: null } }, distinct: ['country'], select: { country: true } }),
    prisma.lead.count({ where: { deletedAt: null, isNri: true, nextFollowUp: { gte: now, lte: new Date(now.getTime() + 7 * 864e5) } } }),
    prisma.lead.count({ where: { deletedAt: null, isNri: true, status: { in: ['BOOKED', 'WON'] } } }),
  ]);

  return (
    <div>
      <PageHeader title="NRI Desk" description="International buyers — time zones, follow-ups and communication in one place." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="NRI leads" value={total} icon={Users2} />
        <StatCard label="Countries" value={countries.length} icon={Globe2} tone="warning" />
        <StatCard label="Follow-ups (7 days)" value={dueSoon} icon={CalendarClock} />
        <StatCard label="Booked / Won" value={won} icon={Trophy} tone="success" />
      </div>
      <NriDesk leads={leads.map((l) => ({
        id: l.id, name: l.name, country: l.country, timezone: l.timezone, status: l.status,
        owner: l.owner?.name ?? null, phone: l.phone, email: l.email,
        nextFollowUp: l.nextFollowUp ? l.nextFollowUp.toISOString() : null,
      }))} />
    </div>
  );
}

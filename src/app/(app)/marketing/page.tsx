import type { Metadata } from 'next';
import { Megaphone, Wallet, Target, Users2 } from 'lucide-react';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
import { MarketingView } from '@/components/marketing/marketing-view';
import { formatCurrency } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Marketing' };

export default async function MarketingPage() {
  await requirePermission('marketing.view');
  const [campaigns, posts, projects, active, agg] = await Promise.all([
    prisma.campaign.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { owner: { select: { name: true } }, project: { select: { name: true } } } }),
    prisma.socialPost.findMany({ orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }], take: 100, include: { createdBy: { select: { name: true } } } }),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.campaign.count({ where: { status: 'ACTIVE' } }),
    prisma.campaign.aggregate({ _sum: { budget: true, spend: true, leadsCount: true } }),
  ]);
  return (
    <div>
      <PageHeader title="Marketing" description="Campaigns, budget, social calendar and creative assets." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active campaigns" value={active} icon={Megaphone} />
        <StatCard label="Total budget" value={formatCurrency(Number(agg._sum.budget ?? 0))} icon={Target} />
        <StatCard label="Spend to date" value={formatCurrency(Number(agg._sum.spend ?? 0))} icon={Wallet} tone="warning" />
        <StatCard label="Leads generated" value={agg._sum.leadsCount ?? 0} icon={Users2} tone="success" />
      </div>
      <MarketingView
        projects={projects}
        campaigns={campaigns.map((c) => ({ id: c.id, name: c.name, channel: c.channel, status: c.status, budget: c.budget ? Number(c.budget) : null, spend: Number(c.spend), leads: c.leadsCount, owner: c.owner?.name ?? null, project: c.project?.name ?? null }))}
        posts={posts.map((p) => ({ id: p.id, title: p.title, channel: p.channel, status: p.status, scheduledAt: p.scheduledAt?.toISOString() ?? null, author: p.createdBy?.name ?? null }))}
      />
    </div>
  );
}

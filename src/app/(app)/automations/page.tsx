import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { readMyAutomationPrefs } from '@/lib/automation/my-prefs';
import { MyAutomations } from '@/components/automation/my-automations';

export const metadata: Metadata = { title: 'My Automations' };
export const dynamic = 'force-dynamic';

export default async function MyAutomationsPage() {
  const ctx = await requirePermission('dashboard.view');
  const row = await prisma.user.findUnique({ where: { id: ctx.user.id }, select: { automationPrefs: true } }).catch(() => null);
  const prefs = readMyAutomationPrefs(row?.automationPrefs);
  return (
    <div className="space-y-6">
      <PageHeader title="My Automations" description="Over a hundred ready-made automations, grouped by department. Switch on the ones you want working for you and tweak the timing — it’s personal to your account and doesn’t change anyone else’s." />
      <MyAutomations prefs={prefs} />
    </div>
  );
}

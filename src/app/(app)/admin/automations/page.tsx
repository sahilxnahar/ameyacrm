import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { AutomationView } from '@/components/admin/automation-view';
import { StarterAutomationsPanel } from '@/components/admin/starter-automations-panel';

export const metadata: Metadata = { title: 'Automations' };

export default async function AutomationsPage() {
  await requirePermission('admin.setting.manage');
  const [rules, runs, users, templates] = await Promise.all([
    prisma.automationRule.findMany({ orderBy: { createdAt: 'desc' } }).catch(() => []),
    prisma.automationRun.findMany({ orderBy: { createdAt: 'desc' }, take: 25, include: { rule: { select: { name: true } } } }).catch(() => []),
    prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.emailTemplate.findMany({ select: { key: true, name: true } }),
  ]);
  return (
    <div>
      <PageHeader title="Automations" description="Trigger → conditions → actions. Auto-assign, notify, follow up, escalate." />
      <StarterAutomationsPanel existingNames={rules.map((r) => r.name)} />
      <AutomationView
        users={users}
        templates={templates}
        rules={rules.map((r) => ({ id: r.id, name: r.name, description: r.description, trigger: r.trigger, isActive: r.isActive, runCount: r.runCount, conditions: (r.conditions as unknown[]) ?? [], actions: (r.actions as unknown[]) ?? [] }))}
        runs={runs.map((r) => ({ id: r.id, rule: r.rule.name, status: r.status, entityType: r.entityType, createdAt: r.createdAt.toISOString() }))}
      />
    </div>
  );
}

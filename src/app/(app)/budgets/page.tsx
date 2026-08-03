import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { budgetVersusActual } from '@/server/services/budget-service';
import { BudgetView } from '@/components/budget/budget-view';

export const metadata: Metadata = { title: 'Budgets' };
export const dynamic = 'force-dynamic';

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('finance.ledger.view');
  const canManage = can(ctx.permissions, 'finance.ledger.manage');
  const sp = await searchParams;

  try {
    const projects = await prisma.project.findMany({
      where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' },
    });
    const projectId = sp.project ?? ctx.user.activeProjectId ?? projects[0]?.id ?? null;
    const costCodeCount = await prisma.costCode.count();

    // The heads you can budget against, and what the current version put on each.
    // Without these the screen could show a variance but never set the figure the
    // variance is measured from — `saveBudget` existed and nothing called it, so
    // every project read as 100% unbudgeted no matter how much planning had gone
    // into it.
    const [costCodes, currentBudget] = await Promise.all([
      prisma.costCode.findMany({
        where: { isActive: true, isGroup: false },
        select: { id: true, code: true, name: true, parentId: true },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      }).catch(() => []),
      projectId
        ? prisma.budget.findFirst({
            where: { projectId },
            orderBy: { version: 'desc' },
            select: {
              id: true, name: true, version: true,
              lines: { select: { amount: true, note: true, costCode: { select: { code: true } } } },
            },
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const data = projectId
      ? await budgetVersusActual(projectId)
      : { heads: [], total: null, hasBudget: false, budgetName: null };

    return (
      <div className="space-y-6">
        <PageHeader
          title="Budgets"
          description="What each head was allowed, what has been committed, and what is left. Committed is the number worth watching — by the time a cost is paid, it was decided months ago."
        />
        <BudgetView
          canManage={canManage}
          projects={projects}
          projectId={projectId}
          costCodeCount={costCodeCount}
          costCodes={costCodes}
          currentVersion={currentBudget?.version ?? null}
          currentName={currentBudget?.name ?? null}
          currentLines={(currentBudget?.lines ?? []).map((l) => ({
            costCode: l.costCode.code, amount: Number(l.amount), note: l.note,
          }))}
          heads={data.heads}
          total={data.total}
          hasBudget={data.hasBudget}
          budgetName={data.budgetName}
        />
      </div>
    );
  } catch (e) {
    return (
      <div className="space-y-6">
        <PageHeader title="Budgets" description="What each head was allowed, and what is left." />
        <PageLoadError error={e} />
      </div>
    );
  }
}

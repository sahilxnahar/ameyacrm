import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { FinanceAccessView } from '@/components/admin/finance-access-view';

export const metadata: Metadata = { title: 'Finance access' };
export const dynamic = 'force-dynamic';

export default async function FinanceAccessPage() {
  await requirePermission('finance.access.manage');

  const [users, grants] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null, status: { in: ['ACTIVE', 'INVITED', 'PENDING'] } },
      select: { id: true, name: true, email: true, role: true, status: true, department: { select: { name: true } } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    }),
    prisma.userPermission.findMany({
      where: { effect: 'ALLOW', permission: { key: { in: ['finance.ledger.view', 'finance.ledger.manage'] } } },
      select: { userId: true, permission: { select: { key: true } } },
    }),
  ]);

  const byUser = new Map<string, { view: boolean; record: boolean }>();
  for (const g of grants) {
    const e = byUser.get(g.userId) ?? { view: false, record: false };
    if (g.permission.key === 'finance.ledger.view') e.view = true;
    if (g.permission.key === 'finance.ledger.manage') e.record = true;
    byUser.set(g.userId, e);
  }

  const people = users.map((u) => {
    const isSuper = u.role === 'SUPER_ADMIN';
    const g = byUser.get(u.id);
    return {
      id: u.id, name: u.name, email: u.email, role: u.role, status: u.status,
      department: u.department?.name ?? null,
      isSuper,
      canView: isSuper || Boolean(g?.view),
      canRecord: isSuper || Boolean(g?.record),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance access"
        description="Who may see expenses, payments made and the cash book. Nobody has it unless they appear here."
      />
      <FinanceAccessView people={people} />
    </div>
  );
}

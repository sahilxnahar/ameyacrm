import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { expenses } from '@/server/services/operations-service';
import { ExpensesRegister } from '@/components/operations/expenses-register';
export const metadata: Metadata = { title: 'Expense Claims' };
export const dynamic = 'force-dynamic';
export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('people.view'); const canManage = can(ctx.permissions, 'people.manage');
  const sp = await searchParams; const projectId = sp.project ?? null;
  try { const [projects, rows] = await Promise.all([prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }), expenses(projectId)]);
    return <div className="space-y-6"><PageHeader title="Expense Claims" description="Staff expenses — submitted, approved, paid. (Full payroll is the one item the plan recommends buying rather than building.)" /><ExpensesRegister canManage={canManage} projects={projects} projectId={projectId} rows={rows} /></div>;
  } catch (e) { return <div className="space-y-6"><PageHeader title="Expense Claims" description="Expense claims." /><PageLoadError error={e} /></div>; }
}

import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { DepartmentsView } from '@/components/admin/departments-view';
import { DEPARTMENT_CATALOGUE } from '@/config/departments';

export const metadata: Metadata = { title: 'Departments' };
export const dynamic = 'force-dynamic';

export default async function DepartmentsPage() {
  await requirePermission('admin.department.manage');
  const [depts, users, counts] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, slug: true, name: true, description: true, color: true, parentId: true, headId: true, isActive: true } }),
    prisma.user.findMany({ where: { status: 'ACTIVE', deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.user.groupBy({ by: ['departmentId'], _count: { _all: true } }),
  ]);
  const headcount = new Map(counts.filter((c) => c.departmentId).map((c) => [c.departmentId as string, c._count._all]));

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Set up the divisions and teams your company actually has, then give each one a head. Reporting lines and work routing follow from this."
      />
      <DepartmentsView
        catalogue={DEPARTMENT_CATALOGUE}
        existingSlugs={depts.map((d) => d.slug)}
        departments={depts.map((d) => ({ ...d, headcount: headcount.get(d.id) ?? 0 }))}
        users={users}
      />
    </div>
  );
}

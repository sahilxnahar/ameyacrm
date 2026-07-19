import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { MaterialView } from '@/components/billing/material-view';

export const metadata: Metadata = { title: 'Material Requests' };

export default async function MaterialRequestsPage() {
  const ctx = await requirePermission('material.view');
  const [requests, projects, departments, approvers] = await Promise.all([
    prisma.materialRequest.findMany({
      where: { deletedAt: undefined }, orderBy: { createdAt: 'desc' }, take: 100,
      include: {
        requester: { select: { name: true } }, department: { select: { name: true } }, project: { select: { name: true } },
        items: true, email: { select: { status: true, toEmails: true } },
        approval: { include: { steps: { where: { approverId: ctx.user.id, status: 'PENDING' }, select: { id: true } } } },
      },
    }),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.department.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { status: 'ACTIVE', role: { in: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'MANAGER'] } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <div>
      <PageHeader title="Material Requests" description="Structured material & purchase requests with approvals and auto-generated emails." />
      <MaterialView
        canApprove={ctx.permissions.isSuperAdmin || ctx.permissions.keys.has('material.approve')}
        requests={requests.map((r) => ({
          id: r.id, reference: r.reference, title: r.title, status: r.status, priority: r.priority,
          requester: r.requester.name, department: r.department?.name ?? null, project: r.project?.name ?? null,
          items: r.items.length, emailStatus: r.email?.status ?? null, recipient: r.email?.toEmails[0] ?? null,
          createdAt: r.createdAt.toISOString(), needsMyApproval: (r.approval?.steps.length ?? 0) > 0,
        }))}
        projects={projects} departments={departments} approvers={approvers}
      />
    </div>
  );
}

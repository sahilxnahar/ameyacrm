import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { CustomersView } from '@/components/customers/customers-view';

export const metadata: Metadata = { title: 'Buyers & Portal' };

export default async function CustomersPage() {
  const ctx = await requirePermission('booking.view');
  const [customers, projects, bookings, updates, tickets, docs, users] = await Promise.all([
    prisma.customer.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.booking.findMany({ orderBy: { createdAt: 'desc' }, take: 300, include: { unit: { select: { code: true } }, lead: { select: { name: true } } } }),
    prisma.constructionUpdate.findMany({ orderBy: { createdAt: 'desc' }, take: 60 }),
    prisma.snagTicket.findMany({ orderBy: { createdAt: 'desc' }, take: 150 }),
    prisma.customerDocument.findMany({ orderBy: { createdAt: 'desc' }, take: 400 }),
    prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  const projName = new Map(projects.map((p) => [p.id, p.name]));
  const custName = new Map(customers.map((c) => [c.id, c.name]));
  const canManage = can(ctx.permissions, 'booking.manage');
  return (
    <div>
      <PageHeader title="Buyers & customer portal" description="Onboard buyers, post construction updates, run the document vault and handle snagging." />
      <CustomersView
        canManage={canManage}
        projects={projects}
        users={users}
        bookings={bookings.map((b) => ({ id: b.id, label: `${b.reference} · ${b.unit?.code ?? b.lead?.name ?? 'unit'}` }))}
        customers={customers.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, projectId: c.projectId, projectName: c.projectId ? projName.get(c.projectId) ?? null : null, isActive: c.isActive, portalToken: c.portalToken }))}
        updates={updates.map((u) => ({ id: u.id, projectId: u.projectId, projectName: projName.get(u.projectId) ?? '—', title: u.title, milestone: u.milestone, body: u.body, imageUrl: u.imageUrl, createdAt: u.createdAt.toISOString() }))}
        tickets={tickets.map((t) => ({ id: t.id, customerId: t.customerId, customerName: custName.get(t.customerId) ?? '—', title: t.title, description: t.description, category: t.category, priority: t.priority, status: t.status, assignedToId: t.assignedToId, createdAt: t.createdAt.toISOString() }))}
        docs={docs.map((d) => ({ id: d.id, customerId: d.customerId, title: d.title, category: d.category, url: d.url }))}
      />
    </div>
  );
}

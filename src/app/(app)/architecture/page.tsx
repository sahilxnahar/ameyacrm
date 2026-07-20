import type { Metadata } from 'next';
import { PencilRuler, FileQuestion, AlertOctagon, Users } from 'lucide-react';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
import { ArchitectureView } from '@/components/architecture/architecture-view';

export const metadata: Metadata = { title: 'Architecture' };

export default async function ArchitecturePage() {
  await requirePermission('architecture.view');
  const [drawings, rfis, issues, consultants, projects, users, drawingCount, openRfis, openIssues] = await Promise.all([
    prisma.drawing.findMany({ orderBy: { updatedAt: 'desc' }, take: 100, include: { project: { select: { name: true } }, revisions: { orderBy: { revision: 'desc' }, take: 1, include: { file: true } } } }),
    prisma.rFI.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { assignedTo: { select: { name: true } }, consultant: { select: { name: true } } } }),
    prisma.issueLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { assignedTo: { select: { name: true } }, project: { select: { name: true } } } }),
    prisma.consultant.findMany({ orderBy: { name: 'asc' } }),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.drawing.count(),
    prisma.rFI.count({ where: { status: 'OPEN' } }),
    prisma.issueLog.count({ where: { status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
  ]);

  return (
    <div>
      <PageHeader title="Architecture" description="Drawings, revisions, RFIs, consultants and issue logs." />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Drawings" value={drawingCount} icon={PencilRuler} />
        <StatCard label="Open RFIs" value={openRfis} icon={FileQuestion} tone="warning" />
        <StatCard label="Open issues" value={openIssues} icon={AlertOctagon} tone={openIssues ? 'destructive' : 'default'} />
        <StatCard label="Consultants" value={consultants.length} icon={Users} />
      </div>
      <ArchitectureView
        projects={projects}
        users={users}
        consultants={consultants.map((c) => ({ id: c.id, name: c.name, firm: c.firm, discipline: c.discipline, email: c.email }))}
        drawings={drawings.map((dr) => ({ id: dr.id, number: dr.number, title: dr.title, discipline: dr.discipline, status: dr.status, revision: dr.currentRevision, project: dr.project?.name ?? null, fileId: dr.revisions[0]?.file?.id ?? null }))}
        rfis={rfis.map((r) => ({ id: r.id, number: r.number, subject: r.subject, question: r.question, response: r.response, status: r.status, assignedTo: r.assignedTo?.name ?? null, consultant: r.consultant?.name ?? null, dueDate: r.dueDate?.toISOString() ?? null }))}
        issues={issues.map((i) => ({ id: i.id, title: i.title, severity: i.severity, status: i.status, assignedTo: i.assignedTo?.name ?? null, project: i.project?.name ?? null }))}
      />
    </div>
  );
}

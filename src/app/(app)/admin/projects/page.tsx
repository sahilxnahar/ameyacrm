import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { ProjectsView } from '@/components/admin/projects-view';

export const metadata: Metadata = { title: 'Projects' };
export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  await requirePermission('admin.project.manage');
  const projects = await prisma.project.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true, name: true, code: true, city: true, address: true, reraNumber: true,
      description: true, isActive: true,
      _count: { select: { units: true, leads: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Every development you are selling or building. Add a new project here and it appears in the project switcher at the top for everyone to work under."
      />
      <ProjectsView
        projects={projects.map((p) => ({
          id: p.id, name: p.name, code: p.code, city: p.city, address: p.address,
          reraNumber: p.reraNumber, description: p.description, isActive: p.isActive,
          units: p._count.units, leads: p._count.leads,
        }))}
      />
    </div>
  );
}

import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { qualityOverview } from '@/server/services/quality-service';
import { QualityView } from '@/components/quality/quality-view';

export const metadata: Metadata = { title: 'Quality & Safety' };
export const dynamic = 'force-dynamic';

export default async function QualityPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('quality.view');
  const canManage = can(ctx.permissions, 'quality.manage');
  const sp = await searchParams;

  try {
    const projects = await prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
    const projectId = sp.project ?? ctx.user.activeProjectId ?? projects[0]?.id ?? null;
    const overview = await qualityOverview(new Date(), projectId);

    return (
      <div className="space-y-6">
        <PageHeader
          title="Quality & Safety"
          description="Inspections with hold points — work that cannot be certified complete until the inspection passes — non-conformances tracked to closure, a safety register where the near-miss is the free warning, and time-bound permits to work. This is what makes the programme's progress numbers honest."
        />
        <QualityView canManage={canManage} projects={projects} projectId={projectId} overview={overview} />
      </div>
    );
  } catch (e) {
    return (
      <div className="space-y-6">
        <PageHeader title="Quality & Safety" description="Inspections, non-conformances, safety and permits." />
        <PageLoadError error={e} />
      </div>
    );
  }
}

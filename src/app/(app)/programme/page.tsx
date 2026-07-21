import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { programmeOverview, activityOptions } from '@/server/services/programme-service';
import { ProgrammeView } from '@/components/programme/programme-view';

export const metadata: Metadata = { title: 'Programme' };
export const dynamic = 'force-dynamic';

export default async function ProgrammePage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('programme.view');
  const canManage = can(ctx.permissions, 'programme.manage');
  const sp = await searchParams;

  try {
    const projects = await prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
    const projectId = sp.project ?? ctx.user.activeProjectId ?? projects[0]?.id ?? null;
    const [overview, activities] = await Promise.all([
      programmeOverview(new Date(), projectId),
      activityOptions(projectId),
    ]);

    return (
      <div className="space-y-6">
        <PageHeader
          title="Programme & Progress"
          description="A real schedule with a critical path, measured progress, and earned value — the honest answer to “are we on track”, not the optimistic one. The critical path is the chain where a day lost is a day lost off the whole project."
        />
        <ProgrammeView
          canManage={canManage}
          projects={projects}
          projectId={projectId}
          activities={activities}
          overview={overview}
        />
      </div>
    );
  } catch (e) {
    return (
      <div className="space-y-6">
        <PageHeader title="Programme & Progress" description="Schedule, progress, earned value and delays." />
        <PageLoadError error={e} />
      </div>
    );
  }
}

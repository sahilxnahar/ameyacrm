import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { getActiveProject } from '@/server/services/active-project-service';
import { SiteOpsBoard } from '@/components/site-ops/site-ops-board';
import type { TimelineLog } from '@/components/site-ops/progress-timeline';

export const metadata: Metadata = { title: 'Site Ops' };
export const dynamic = 'force-dynamic';

export default async function SiteOpsPage() {
  const ctx = await requirePermission('document.create');
  const active = await getActiveProject(ctx.user.id);

  const [projects, rows] = await Promise.all([
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.dailySiteLog.findMany({
      where: active.id ? { projectId: active.id } : undefined,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 60,
      select: {
        id: true, date: true, weather: true, laborCount: true, notes: true,
        project: { select: { name: true } },
        author: { select: { name: true } },
        photos: { select: { id: true, url: true, milestoneTag: true }, orderBy: { capturedAt: 'asc' } },
      },
    }).catch(() => []),
  ]);

  const logs: TimelineLog[] = rows.map((r) => ({
    id: r.id,
    date: r.date.toISOString(),
    weather: r.weather,
    laborCount: r.laborCount,
    notes: r.notes,
    projectName: r.project?.name ?? 'Unassigned',
    authorName: r.author?.name ?? null,
    photos: r.photos,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Site Ops"
        description={`Daily field logs and the 4D BIM progress timeline${active.id ? ` for ${active.name}` : ' across all projects'}. Log weather, labour and progress photos from your phone at site.`}
      />
      <SiteOpsBoard projects={projects} activeProjectId={active.id} logs={logs} />
    </div>
  );
}

import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { getActiveProject } from '@/server/services/active-project-service';
import { SitePhotoCapture } from '@/components/site/site-photo-capture';

export const metadata: Metadata = { title: 'Site photos' };
export const dynamic = 'force-dynamic';

export default async function SitePhotosPage() {
  const ctx = await requirePermission('document.create');
  const [projects, active, recent] = await Promise.all([
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    getActiveProject(ctx.user.id),
    prisma.document.findMany({
      where: { folder: { name: { not: undefined }, parent: { parent: { name: 'Site Photos' } } } },
      orderBy: { createdAt: 'desc' },
      take: 24,
      select: {
        id: true, title: true, createdAt: true,
        folder: { select: { name: true, parent: { select: { name: true } } } },
        versions: { orderBy: { version: 'desc' }, take: 1, select: { file: { select: { key: true, id: true } } } },
      },
    }).catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Site photos"
        description="Take photos at site. They file themselves by project and month — no folder to choose."
      />
      <SitePhotoCapture
        projects={projects}
        activeProjectId={active.id}
        recent={recent.map((d) => ({
          id: d.id,
          title: d.title,
          when: d.createdAt.toISOString(),
          folder: `${d.folder?.parent?.name ?? ''} / ${d.folder?.name ?? ''}`.trim(),
          fileId: d.versions[0]?.file.id ?? null,
        }))}
      />
    </div>
  );
}

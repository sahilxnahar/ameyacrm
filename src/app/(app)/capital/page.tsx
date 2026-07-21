import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { capitalOverview } from '@/server/services/capital-service';
import { CapitalView } from '@/components/capital/capital-view';

export const metadata: Metadata = { title: 'Capital & Escrow' };
export const dynamic = 'force-dynamic';

export default async function CapitalPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('capital.view');
  const canManage = can(ctx.permissions, 'capital.manage');
  const sp = await searchParams;

  try {
    const projects = await prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
    const projectId = sp.project ?? ctx.user.activeProjectId ?? projects[0]?.id ?? null;
    const overview = await capitalOverview(projectId);

    return (
      <div className="space-y-6">
        <PageHeader
          title="Capital & Escrow"
          description="The capital stack, the investor register, and the RERA escrow control — 70% of buyer receipts ring-fenced, withdrawn only against certified progress, enforced on every movement. Plus the loan covenants you have promised to hold, with a warning before a breach rather than a letter after one."
        />
        <CapitalView canManage={canManage} projects={projects} projectId={projectId} overview={overview} />
      </div>
    );
  } catch (e) {
    return (
      <div className="space-y-6">
        <PageHeader title="Capital & Escrow" description="Capital stack, investors, RERA escrow and covenants." />
        <PageLoadError error={e} />
      </div>
    );
  }
}

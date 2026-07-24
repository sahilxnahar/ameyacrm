import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { decisions } from '@/server/services/compliance-service';
import { KnowledgeRegister } from '@/components/compliance/knowledge-register';
export const metadata: Metadata = { title: 'Decision Log' };
export const dynamic = 'force-dynamic';
export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await requirePermission('knowledge.view');
  const canManage = can(ctx.permissions, 'knowledge.manage');
  const sp = await searchParams; const projectId = sp.project ?? null;
  try {
    const [projects, rows] = await Promise.all([prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }), decisions(projectId)]);
    return <div className="space-y-6"><PageHeader title="Decision Log" description="What was decided, when, by whom and on what information — the institutional memory that walks out of the door with people otherwise." /><KnowledgeRegister canManage={canManage} projects={projects} projectId={projectId} rows={rows} /></div>;
  } catch (e) { return <div className="space-y-6"><PageHeader title="Decision Log" description="Decisions." /><PageLoadError error={e} /></div>; }
}

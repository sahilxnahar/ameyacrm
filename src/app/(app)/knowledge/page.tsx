import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { decisions, sops, lessons, registerCounts } from '@/server/services/compliance-service';
import { KnowledgeRegister } from '@/components/compliance/knowledge-register';
import { RegisterTabs } from '@/components/compliance/register-tabs';
import { SopRegister, LessonsRegister } from '@/components/compliance/extra-registers';

export const metadata: Metadata = { title: 'Knowledge' };
export const dynamic = 'force-dynamic';

const DESCRIPTIONS: Record<string, string> = {
  decisions: 'What was decided, when, by whom and on what information — the institutional memory that walks out of the door with people otherwise.',
  sops: 'How things are done here, written down once, so the answer does not depend on who is in the office.',
  lessons: 'What this project taught, in a form the next one can act on.',
};

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ project?: string; view?: string }> }) {
  const ctx = await requirePermission('knowledge.view');
  const canManage = can(ctx.permissions, 'knowledge.manage');
  const sp = await searchParams;
  const projectId = sp.project ?? null;
  const view = ['decisions', 'sops', 'lessons'].includes(sp.view ?? '') ? sp.view! : 'decisions';

  try {
    const [projects, counts, decisionRows, sopRows, lessonRows] = await Promise.all([
      prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      registerCounts(projectId),
      view === 'decisions' ? decisions(projectId) : Promise.resolve([]),
      view === 'sops' ? sops() : Promise.resolve([]),
      view === 'lessons' ? lessons(projectId) : Promise.resolve([]),
    ]);

    return (
      <div className="space-y-6">
        <PageHeader title="Knowledge" description={DESCRIPTIONS[view] ?? DESCRIPTIONS.decisions!} />
        <RegisterTabs
          basePath="/knowledge"
          current={view}
          projectId={projectId}
          tabs={[
            { key: 'decisions', label: 'Decision log', count: counts.decision },
            { key: 'sops', label: 'SOPs', count: counts.sop },
            { key: 'lessons', label: 'Lessons learned', count: counts.lesson },
          ]}
        />
        {view === 'decisions' && <KnowledgeRegister canManage={canManage} projects={projects} projectId={projectId} rows={decisionRows} />}
        {view === 'sops' && <SopRegister canManage={canManage} rows={sopRows} />}
        {view === 'lessons' && <LessonsRegister canManage={canManage} projects={projects} projectId={projectId} rows={lessonRows} />}
      </div>
    );
  } catch (e) {
    return <div className="space-y-6"><PageHeader title="Knowledge" description="Decisions, SOPs and lessons learned." /><PageLoadError error={e} /></div>;
  }
}

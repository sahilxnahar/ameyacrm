import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { ScreenHelp } from '@/components/layout/screen-help';
import { PageLoadError } from '@/components/layout/page-load-error';
import { bankPositions, cashForecast, loanBook, reconciliationView } from '@/server/services/treasury-service';
import { TreasuryView } from '@/components/treasury/treasury-view';

export const metadata: Metadata = { title: 'Cash Flow & Treasury' };
export const dynamic = 'force-dynamic';

export default async function TreasuryPage({ searchParams }: { searchParams: Promise<{ project?: string; account?: string }> }) {
  const ctx = await requirePermission('treasury.view');
  const canManage = can(ctx.permissions, 'treasury.manage');
  const sp = await searchParams;
  const projectId = sp.project ?? null;

  try {
    const [projects, positions, forecast, loans] = await Promise.all([
      prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      bankPositions(projectId),
      cashForecast(new Date()),
      loanBook(projectId),
    ]);

    const activeAccountId = sp.account ?? positions[0]?.id ?? null;
    const recon = activeAccountId ? await reconciliationView(activeAccountId) : { lines: [], suggestions: [], candidateCount: 0 };

    return (
      <div className="space-y-6">
        <PageHeader
          title="Cash Flow & Treasury"
          description="Every bank account on one screen, statement lines matched to the payments already recorded against their UTR, and a twelve-week forecast whose lowest point is the number that decides whether a payment run is safe. No payment gateway — a statement is a file."
        />
        <ScreenHelp id="treasury" />
        <TreasuryView
          canManage={canManage}
          projects={projects}
          projectId={projectId}
          positions={positions}
          forecast={forecast}
          loans={loans}
          activeAccountId={activeAccountId}
          reconLines={recon.lines}
          reconSuggestions={recon.suggestions}
          candidateCount={recon.candidateCount}
        />
      </div>
    );
  } catch (e) {
    return (
      <div className="space-y-6">
        <PageHeader title="Cash Flow & Treasury" description="Bank position, reconciliation, forecast and loans." />
        <PageLoadError error={e} />
      </div>
    );
  }
}

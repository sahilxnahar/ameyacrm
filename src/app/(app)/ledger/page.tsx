import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { trialBalance, profitAndLoss, balanceSheet } from '@/server/services/ledger-service';
import { LedgerView } from '@/components/ledger/ledger-view';

export const metadata: Metadata = { title: 'Ledger' };
export const dynamic = 'force-dynamic';

export default async function LedgerPage() {
  const ctx = await requirePermission('finance.ledger.view');
  const canManage = can(ctx.permissions, 'finance.ledger.manage');

  try {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 3, 1); // Indian financial year
    const from = now < yearStart ? new Date(now.getFullYear() - 1, 3, 1) : yearStart;

    const [tb, pl, bs, accountCount, entries] = await Promise.all([
      trialBalance({ upto: now }),
      profitAndLoss({ from, to: now }),
      balanceSheet({ upto: now }),
      prisma.account.count(),
      prisma.journalEntry.findMany({
        orderBy: { entryDate: 'desc' }, take: 30,
        include: { lines: { include: { account: { select: { code: true, name: true } } } } },
      }),
    ]);

    return (
      <div className="space-y-6">
        <PageHeader
          title="Ledger"
          description="Every rupee, recorded twice. The trial balance proves the books add up; the statements are generated from it rather than assembled by hand."
        />
        <LedgerView
          canManage={canManage}
          accountCount={accountCount}
          trial={tb}
          pl={pl}
          bs={bs}
          from={from.toISOString()}
          entries={entries.map((e) => ({
            id: e.id, number: e.number, date: e.entryDate.toISOString(),
            narration: e.narration, status: e.status,
            sourceType: e.sourceType, total: e.lines.reduce((a, l) => a + Number(l.debit), 0),
            lines: e.lines.map((l) => ({
              account: `${l.account.code} · ${l.account.name}`,
              debit: Number(l.debit), credit: Number(l.credit),
            })),
          }))}
        />
      </div>
    );
  } catch (e) {
    return (
      <div className="space-y-6">
        <PageHeader title="Ledger" description="Every rupee, recorded twice." />
        <PageLoadError error={e} />
      </div>
    );
  }
}

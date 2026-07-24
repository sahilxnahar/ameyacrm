import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { listLedgers, getLedger } from '@/server/services/vendor-ledger-service';
import { prisma } from '@/lib/db/prisma';
import { LedgerView } from '@/components/ledgers/ledger-view';

export const metadata: Metadata = { title: 'Vendor Ledgers' };
export const dynamic = 'force-dynamic';

export default async function LedgersPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const ctx = await requirePermission('finance.ledger.view');
  try {
    const sp = await searchParams;
    const ledgers = await listLedgers();
    const activeId = sp.v ?? null;
    const detail = activeId ? await getLedger(activeId) : null;
    const limitRow = await prisma.setting.findUnique({ where: { key: 'finance.payment_approval_limit' } });
    const approvalLimit = Number(limitRow?.value ?? 0) || 0;
    return (
      <div className="space-y-6">
        <PageHeader title="Vendor Ledgers" description="Every payee and what you've paid them — one ledger per person, built from your payments. Import an Excel/Google Sheet, save their bank details, and merge two names that are really the same person." />
        <LedgerView
          ledgers={ledgers}
          activeId={detail ? activeId : null}
          detail={detail}
          approvalLimit={approvalLimit}
          canManage={can(ctx.permissions, 'billing.bill.manage')}
          canHardDelete={ctx.permissions.isSuperAdmin || can(ctx.permissions, 'admin.setting.manage')}
        />
      </div>
    );
  } catch (e) {
    return <div className="space-y-6"><PageHeader title="Vendor Ledgers" description="Payee ledgers." /><PageLoadError error={e} /></div>;
  }
}

import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { borrowingBook } from '@/server/services/treasury-service';
import { summariseBorrowings } from '@/lib/treasury/borrowing-interest';
import { BorrowingsView } from '@/components/treasury/borrowings-view';

export const metadata: Metadata = { title: 'Borrowings' };
export const dynamic = 'force-dynamic';

export default async function BorrowingsPage() {
  const ctx = await requirePermission('treasury.view');
  const canManage = ctx.permissions.isSuperAdmin || ctx.permissions.keys.has('treasury.manage');

  const rows = await borrowingBook(new Date());
  const summary = summariseBorrowings(
    rows.map((r) => ({ outstanding: r.outstanding, interestAccrued: r.interestAccrued, interestPaid: r.interestPaid, interestRate: r.interestRate })),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Borrowings"
        description="Loans from banks and NBFCs — how much you've drawn, what's outstanding, and the interest building up on each."
      />
      <BorrowingsView rows={rows} summary={summary} canManage={canManage} />
    </div>
  );
}

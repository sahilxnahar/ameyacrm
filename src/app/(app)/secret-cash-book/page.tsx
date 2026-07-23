import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { canAccess, isUnlocked, getNominees } from '@/lib/secret-cashbook/access';
import { SecretCashLock } from '@/components/finance/secret-cash-lock';
import { SecretCashBookView } from '@/components/finance/secret-cash-book-view';

export const metadata: Metadata = { title: 'Secret Cash Book' };
export const dynamic = 'force-dynamic';

export default async function SecretCashBookPage() {
  const ctx = await requireAuth();
  const allowed = await canAccess(ctx.user.id, ctx.permissions.isSuperAdmin);

  if (!allowed) {
    return (
      <div>
        <PageHeader title="Secret Cash Book" description="A private, locked cash book." />
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          This is a private cash book. You don’t have access. Ask the owner to add you as a nominee.
        </div>
      </div>
    );
  }

  const unlocked = await isUnlocked(ctx.user.id);
  if (!unlocked) {
    return (
      <div>
        <PageHeader title="Secret Cash Book" description="Locked. Open it with a one-time code sent to your email and WhatsApp." />
        <SecretCashLock />
      </div>
    );
  }

  const [entries, nominees, users] = await Promise.all([
    prisma.secretCashEntry.findMany({ orderBy: { entryDate: 'desc' }, take: 2000 }),
    getNominees(),
    ctx.permissions.isSuperAdmin
      ? prisma.user.findMany({ where: { status: 'ACTIVE', deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
      : Promise.resolve([]),
  ]);

  let running = 0;
  const rows = entries
    .slice()
    .reverse()
    .map((e) => {
      const amt = Number(e.amount);
      running += e.direction === 'IN' ? amt : -amt;
      return {
        id: e.id, date: e.entryDate.toISOString(), direction: e.direction, amount: amt,
        party: e.party, mode: e.mode, reference: e.reference, note: e.note, balance: running,
      };
    })
    .reverse();

  const totalIn = entries.filter((e) => e.direction === 'IN').reduce((s, e) => s + Number(e.amount), 0);
  const totalOut = entries.filter((e) => e.direction === 'OUT').reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div>
      <PageHeader title="Secret Cash Book" description="Private. Only you and your nominees can open this, and it re-locks itself." />
      <SecretCashBookView
        rows={rows}
        totalIn={totalIn}
        totalOut={totalOut}
        balance={totalIn - totalOut}
        isSuperAdmin={ctx.permissions.isSuperAdmin}
        nominees={nominees}
        users={users}
      />
    </div>
  );
}

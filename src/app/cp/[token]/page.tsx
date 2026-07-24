import type { Metadata } from 'next';
import { Handshake, Users2, BadgeIndianRupee, UserPlus } from 'lucide-react';
import { prisma } from '@/lib/db/prisma';
import { CpLeadForm } from '@/components/cp/cp-lead-form';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Channel Partner · Ameya Heights', robots: { index: false } };

const STATUS_CLS: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-700', INVOICED: 'bg-blue-500/15 text-blue-700', PAID: 'bg-emerald-500/15 text-emerald-700',
};

export default async function CpPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cp = await prisma.channelPartner.findUnique({ where: { portalToken: token } });
  if (!cp || cp.status === 'SUSPENDED') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-brass">Ameya Heights</h1>
        <p className="mt-3 text-sm text-muted-foreground">This channel-partner link is invalid or has been suspended. Please contact our sales office.</p>
      </main>
    );
  }

  const [leads, payouts] = await Promise.all([
    prisma.lead.findMany({ where: { channelPartnerId: cp.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, name: true, status: true, createdAt: true, cpLockedUntil: true } }),
    prisma.brokeragePayout.findMany({ where: { channelPartnerId: cp.id }, orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  const earned = payouts.reduce((s, p) => s + Number(p.amount), 0);
  const paid = payouts.filter((p) => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0);
  const pending = earned - paid;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-brass">Ameya Heights</h1>
          <p className="text-sm text-muted-foreground">Channel Partner · {cp.firmName}</p>
        </div>
        <Handshake className="h-8 w-8 text-brass/60" />
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Clients registered" value={String(leads.length)} icon={<Users2 className="h-4 w-4" />} />
        <Tile label="Commission earned" value={formatCurrency(earned)} icon={<BadgeIndianRupee className="h-4 w-4" />} />
        <Tile label="Paid to you" value={formatCurrency(paid)} />
        <Tile label="Pending" value={formatCurrency(pending)} />
      </section>

      <section className="rounded-xl border p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><UserPlus className="h-5 w-5 text-brass" /> Register a client</h2>
        <p className="mb-3 text-xs text-muted-foreground">Register your client here to lock them to you for 60 days. If someone else has already registered the same phone or email, you'll be told — this prevents disputes.</p>
        <CpLeadForm token={token} />
      </section>

      <section className="rounded-xl border p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><Users2 className="h-5 w-5 text-brass" /> Your clients</h2>
        {leads.length === 0 ? <p className="text-sm text-muted-foreground">No clients registered yet.</p> : (
          <div className="space-y-1">
            {leads.map((l) => (
              <div key={l.id} className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
                <span>{l.name}<span className="block text-xs text-muted-foreground">Registered {formatDate(l.createdAt.toISOString())}{l.cpLockedUntil ? ` · locked to you until ${formatDate(l.cpLockedUntil.toISOString())}` : ''}</span></span>
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs">{l.status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><BadgeIndianRupee className="h-5 w-5 text-brass" /> Your commissions</h2>
        {payouts.length === 0 ? <p className="text-sm text-muted-foreground">No commissions recorded yet. They appear here as your clients book.</p> : (
          <div className="space-y-1">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
                <span>{formatCurrency(Number(p.amount))}<span className="block text-xs text-muted-foreground">{p.stage ?? 'Commission'}{p.dueDate ? ` · due ${formatDate(p.dueDate.toISOString())}` : ''}</span></span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_CLS[p.status] ?? 'bg-secondary'}`}>{p.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="pb-6 pt-2 text-center text-xs text-muted-foreground">Ameya Heights · Channel Partner Portal</footer>
    </main>
  );
}

function Tile({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">{icon}{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

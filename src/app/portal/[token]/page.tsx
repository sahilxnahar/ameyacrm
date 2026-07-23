import type { Metadata } from 'next';
import { Home, FileText, HardHat, Wrench, CheckCircle2 } from 'lucide-react';
import { prisma } from '@/lib/db/prisma';
import { SnagForm } from '@/components/portal/snag-form';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { classifySnag, snagSla } from '@/lib/portal/snag-sla';

const VAULT_GROUPS: Array<{ key: string; label: string; match: RegExp }> = [
  { key: 'kyc', label: 'KYC', match: /kyc|pan|aadhaar|aadhar|identity|address proof/i },
  { key: 'legal', label: 'Legal', match: /legal|agreement|sale deed|jda|allotment|title|possession/i },
  { key: 'financial', label: 'Financial', match: /financial|receipt|demand|invoice|payment|loan|noc/i },
  { key: 'handover', label: 'Handover', match: /handover|possession|snag|occupancy|oc\b/i },
];
function vaultGroupOf(category: string | null, title: string): string {
  const s = `${category ?? ''} ${title}`;
  return VAULT_GROUPS.find((g) => g.match.test(s))?.label ?? 'Other';
}

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your Home · Ameya Heights', robots: { index: false } };

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const customer = await prisma.customer.findUnique({ where: { portalToken: token } });
  if (!customer || !customer.isActive) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-brass">Ameya Heights</h1>
        <p className="mt-3 text-sm text-muted-foreground">This portal link is invalid or has been disabled. Please contact our sales office for a new link.</p>
      </main>
    );
  }
  const booking = customer.bookingId
    ? await prisma.booking.findUnique({ where: { id: customer.bookingId }, include: { unit: { include: { project: true } }, payments: { orderBy: [{ dueDate: 'asc' }] } } })
    : null;
  const projectId = customer.projectId ?? booking?.unit?.projectId ?? null;
  const [updates, docs, tickets] = await Promise.all([
    projectId ? prisma.constructionUpdate.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 20 }) : Promise.resolve([]),
    prisma.customerDocument.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'desc' } }),
    prisma.snagTicket.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'desc' } }),
  ]);
  const paid = (booking?.payments ?? []).filter((p) => p.status === 'PAID').reduce((s, p) => s + Number(p.amount), 0);
  const totalDue = (booking?.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center justify-between border-b pb-4">
        <div><h1 className="font-display text-2xl font-semibold text-brass">Ameya Heights</h1><p className="text-sm text-muted-foreground">Welcome, {customer.name}</p></div>
        <Home className="h-8 w-8 text-brass/60" />
      </header>

      {booking && (
        <section className="rounded-xl border p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><Home className="h-5 w-5 text-brass" /> Your home</h2>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Spec k="Unit" v={booking.unit?.code ?? '—'} /><Spec k="Project" v={booking.unit?.project?.name ?? '—'} />
            <Spec k="Type" v={booking.unit?.typology ?? '—'} /><Spec k="Agreement value" v={booking.agreementValue ? formatCurrency(Number(booking.agreementValue)) : '—'} />
          </div>
          {booking.payments.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium">Payment schedule</span><span className="text-muted-foreground">Paid {formatCurrency(paid)} of {formatCurrency(totalDue)}</span></div>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <tbody>
                    {booking.payments.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="p-2">{p.label}</td>
                        <td className="p-2 text-muted-foreground">{p.dueDate ? formatDate(p.dueDate.toISOString()) : '—'}</td>
                        <td className="p-2 text-right font-medium">{formatCurrency(Number(p.amount))}</td>
                        <td className="p-2 text-right"><span className={`rounded-full px-2 py-0.5 text-xs ${p.status === 'PAID' ? 'bg-emerald-500/15 text-emerald-700' : p.status === 'OVERDUE' ? 'bg-rose-500/15 text-rose-700' : 'bg-amber-500/15 text-amber-700'}`}>{p.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><HardHat className="h-5 w-5 text-brass" /> Construction updates</h2>
        {updates.length === 0 && <p className="text-sm text-muted-foreground">No updates posted yet.</p>}
        <div className="space-y-3">
          {updates.map((u) => (
            <div key={u.id} className="border-l-2 border-brass/40 pl-3">
              <p className="text-sm font-medium">{u.title}{u.milestone ? ` · ${u.milestone}` : ''}</p>
              <p className="text-xs text-muted-foreground">{formatDate(u.createdAt.toISOString())}</p>
              {u.body && <p className="mt-1 text-sm text-foreground/80">{u.body}</p>}
              {u.imageUrl && <img src={u.imageUrl} alt="" className="mt-2 max-h-64 rounded-lg border object-cover" />}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><FileText className="h-5 w-5 text-brass" /> Document vault</h2>
        {docs.length === 0 && <p className="text-sm text-muted-foreground">No documents shared yet.</p>}
        <div className="space-y-4">
          {['KYC', 'Legal', 'Financial', 'Handover', 'Other'].map((group) => {
            const inGroup = docs.filter((d) => vaultGroupOf(d.category, d.title) === group);
            if (inGroup.length === 0) return null;
            return (
              <div key={group}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brass">{group}</p>
                <div className="space-y-1">
                  {inGroup.map((d) => (
                    <div key={d.id} className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
                      <span>{d.title}</span>
                      <a href={d.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-brass underline">Download</a>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><Wrench className="h-5 w-5 text-brass" /> Report an issue (snagging)</h2>
        <SnagForm token={token} />
        {tickets.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Your reported issues</p>
            {tickets.map((t) => {
              const sla = snagSla(classifySnag(t.category, t.title), t.createdAt, t.resolvedAt);
              const resolved = t.status === 'RESOLVED';
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 border-b py-1.5 text-sm last:border-0">
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  {!resolved && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${sla.overdue ? 'bg-rose-500/15 text-rose-700' : 'bg-amber-500/15 text-amber-700'}`}>{sla.label}</span>}
                  <span className={`flex shrink-0 items-center gap-1 text-xs ${resolved ? 'text-emerald-700' : 'text-amber-700'}`}>{resolved && <CheckCircle2 className="h-3 w-3" />}{t.status.replace('_', ' ')}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <footer className="pb-6 pt-2 text-center text-xs text-muted-foreground">Ameya Heights · Your trusted home partner</footer>
    </main>
  );
}

function Spec({ k, v }: { k: string; v: string }) {
  return <div><p className="text-[10px] uppercase text-muted-foreground">{k}</p><p className="font-medium">{v}</p></div>;
}

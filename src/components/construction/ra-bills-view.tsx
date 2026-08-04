'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFocusTrap } from '@/lib/a11y/use-focus-trap';
import { useUnsavedChanges } from '@/lib/forms/use-unsaved-changes';
import { toast } from 'sonner';
import { Plus, HardHat, ShieldCheck, PiggyBank, Landmark, Send, Wallet, X } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Monogram, statusAccent, RecordList } from '@/components/shared/record-row';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { TDS_SECTIONS } from '@/config/tds-sections';
import { computeRaBill } from '@/lib/construction/ra-bill';
import { createRaBill, submitRaBill, settleRaBill } from '@/server/actions/ra-bills';

interface Bill {
  id: string; number: string; status: string; vendorName: string;
  gross: number; cess: number; retention: number; tds: number; tdsSection: string | null; net: number; lines: number; createdAt: string;
}
type Opt = { id: string; name: string };
const inr = (n: number) => formatCurrency(n);

export function RaBillsView({ bills, vendors, projects, approvers, summary, canManage, canPay }: {
  bills: Bill[]; vendors: Opt[]; projects: Opt[]; approvers: Opt[];
  summary: { pendingCount: number; certifiedUnpaid: number; cessAccrued: number; retentionHeld: number };
  canManage: boolean; canPay: boolean;
}) {
  // AMH-029 — router.refresh() re-runs the server components and swaps the
  // new HTML in. router.refresh() threw the whole document away: scroll
  // position, open filters, a half-typed field in another panel, and a
  // second of white screen. The server action already calls revalidatePath,
  // so the data is fresh either way.
  const router = useRouter();
  const [showNew, setShowNew] = React.useState(false);
  const [submitting, setSubmitting] = React.useState<Bill | null>(null);
  /*
   * `isPending` is kept, not discarded.
   *
   * It used to be `const [, start] = useTransition()`, so the Pay button was
   * never disabled and a double-click sent two settlements. The server now
   * refuses the second one atomically, but a button that looks live while a
   * payment is in flight invites the click in the first place — and the same
   * pattern was in 13 components.
   */
  const [pending, start] = React.useTransition();

  // New-bill form state
  const [vendorId, setVendorId] = React.useState('');
  const [projectId, setProjectId] = React.useState('');
  const [gross, setGross] = React.useState('');
  const [cessPct, setCessPct] = React.useState('1');
  const [retPct, setRetPct] = React.useState('5');
  const [ded, setDed] = React.useState('0');
  const [section, setSection] = React.useState('194C');
  const [narration, setNarration] = React.useState('');

  /*
   * An RA bill is a money document with seven fields and a computed preview the
   * engineer checks before saving. Losing it to a closed tab means re-deriving
   * the certified value from the measurement sheet again.
   */
  useUnsavedChanges(showNew && (gross.trim() !== '' || narration.trim() !== '' || vendorId !== '' || projectId !== ''));

  const preview = computeRaBill({
    grossValue: Number(gross) || 0, deductions: Number(ded) || 0,
    cessPercent: Number(cessPct) || 0, retentionPercent: Number(retPct) || 0, tdsSection: section,
  });

  function create() {
    if (!(Number(gross) > 0)) { toast.error('Enter the certified gross value.'); return; }
    start(async () => {
      const r = await createRaBill({ vendorId: vendorId || undefined, projectId: projectId || undefined, grossValue: gross, deductions: ded, cessPercent: cessPct, retentionPercent: retPct, tdsSection: section, narration: narration || undefined });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('RA bill created'); setShowNew(false); setGross(''); setNarration(''); router.refresh();
    });
  }

  const settle = (b: Bill) => start(async () => {
    const r = await settleRaBill(b.id);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success(`${b.number} settled`); router.refresh();
  });

  return (
    <div className="space-y-6">
      <div className="stat-grid">
        <StatCard label="Pending certification" value={summary.pendingCount} icon={ShieldCheck} tone={summary.pendingCount ? 'warning' : 'default'} />
        <StatCard label="Certified, unpaid" value={inr(summary.certifiedUnpaid)} icon={Wallet} tone="warning" />
        <StatCard label="BOCW cess accrued" value={inr(summary.cessAccrued)} icon={Landmark} />
        <StatCard label="Retention held" value={inr(summary.retentionHeld)} icon={PiggyBank} />
      </div>

      {canManage && (
        <div>
          <Button onClick={() => setShowNew((v) => !v)} className="gap-1"><Plus className="h-4 w-4" /> New RA bill</Button>
          {showNew && (
            <Card className="mt-3 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm"><span className="mb-1 block text-muted-foreground">Contractor</span>
                  <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                    <option value="">— select —</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </label>
                <label className="text-sm"><span className="mb-1 block text-muted-foreground">Project</span>
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                    <option value="">— select —</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label className="text-sm"><span className="mb-1 block text-muted-foreground">Certified gross value (₹)</span>
                  <Input value={gross} onChange={(e) => setGross(e.target.value)} inputMode="numeric" placeholder="0" /></label>
                <label className="text-sm"><span className="mb-1 block text-muted-foreground">Ad-hoc deductions (₹)</span>
                  <Input value={ded} onChange={(e) => setDed(e.target.value)} inputMode="numeric" /></label>
                <label className="text-sm"><span className="mb-1 block text-muted-foreground">BOCW cess %</span>
                  <Input value={cessPct} onChange={(e) => setCessPct(e.target.value)} inputMode="decimal" /></label>
                <label className="text-sm"><span className="mb-1 block text-muted-foreground">Retention %</span>
                  <Input value={retPct} onChange={(e) => setRetPct(e.target.value)} inputMode="decimal" /></label>
                <label className="text-sm"><span className="mb-1 block text-muted-foreground">TDS section</span>
                  <select value={section} onChange={(e) => setSection(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                    {TDS_SECTIONS.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.label}</option>)}
                  </select>
                </label>
                <label className="text-sm"><span className="mb-1 block text-muted-foreground">Narration</span>
                  <Input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="e.g. RA-3 slab work, Tower B" /></label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-muted/50 p-3 text-sm sm:grid-cols-5">
                <div><div className="text-xs text-muted-foreground">Cess</div><div className="tabular-nums">{inr(preview.cessAmount)}</div></div>
                <div><div className="text-xs text-muted-foreground">Retention</div><div className="tabular-nums">{inr(preview.retentionAmount)}</div></div>
                <div><div className="text-xs text-muted-foreground">TDS {preview.tdsRate}%</div><div className="tabular-nums">{inr(preview.tdsAmount)}</div></div>
                <div><div className="text-xs text-muted-foreground">Deductions</div><div className="tabular-nums">{inr(preview.deductions)}</div></div>
                <div><div className="text-xs text-muted-foreground">Net payable</div><div className="font-semibold text-primary tabular-nums">{inr(preview.netPayable)}</div></div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
                <Button onClick={create} className="gap-1"><Plus className="h-4 w-4" /> Create draft</Button>
              </div>
            </Card>
          )}
        </div>
      )}

      <RecordList empty="A running-account bill is raised against measured work as it progresses. Raise the first one when a contractor has work to certify.">
        {bills.map((b) => (
          <div key={b.id} className={cn('flex flex-wrap items-center gap-3 border-b border-l-2 px-3 py-2.5 last:border-b-0', statusAccent(b.status))}>
            <Monogram name={b.vendorName} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{b.vendorName}</div>
              <div className="truncate text-xs text-muted-foreground"><span className="font-mono">{b.number}</span> · gross {inr(b.gross)} · TDS {b.tdsSection ?? '—'} · net {inr(b.net)}</div>
            </div>
            <Badge variant={b.status === 'PAID' || b.status === 'CERTIFIED' ? 'success' : b.status === 'REJECTED' ? 'destructive' : b.status === 'PENDING' ? 'warning' : 'secondary'} className="shrink-0">
              {b.status === 'PENDING' ? 'Awaiting cert.' : b.status.charAt(0) + b.status.slice(1).toLowerCase()}
            </Badge>
            <div className="w-28 shrink-0 text-right font-medium tabular-nums">{inr(b.net)}</div>
            <div className="flex shrink-0 gap-1">
              {canManage && (b.status === 'DRAFT' || b.status === 'REJECTED') && (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => setSubmitting(b)} className="gap-1"><Send className="h-3.5 w-3.5" /> Submit</Button>
              )}
              {canPay && b.status === 'CERTIFIED' && (
                <Button size="sm" disabled={pending} onClick={() => settle(b)} className="gap-1">
                  <Wallet className="h-3.5 w-3.5" /> {pending ? 'Paying…' : 'Pay'}
                </Button>
              )}
            </div>
          </div>
        ))}
      </RecordList>

      {submitting && (
        <SubmitModal bill={submitting} approvers={approvers} onClose={() => setSubmitting(null)} />
      )}
    </div>
  );
}

function SubmitModal({ bill, approvers, onClose }: { bill: Bill; approvers: Opt[]; onClose: () => void }) {
  // AMH-029 — router.refresh() re-runs the server components and swaps the
  // new HTML in. router.refresh() threw the whole document away: scroll
  // position, open filters, a half-typed field in another panel, and a
  // second of white screen. The server action already calls revalidatePath,
  // so the data is fresh either way.
  const router = useRouter();
  const [sel, setSel] = React.useState<string[]>([]);
  const [, start] = React.useTransition();
  function submit() {
    if (sel.length === 0) { toast.error('Pick at least the Independent Engineer / certifier.'); return; }
    start(async () => {
      const r = await submitRaBill(bill.id, sel);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`${bill.number} sent for certification`); onClose(); router.refresh();
    });
  }
  const panel = useFocusTrap<HTMLDivElement>(true, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div ref={panel} role="dialog" aria-modal="true" className="w-full max-w-md rounded-xl border bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between"><div className="flex items-center gap-2 font-semibold"><HardHat className="h-4 w-4 text-primary" /> Submit {bill.number} for certification</div><button onClick={onClose} aria-label="Close"><X className="h-4 w-4 text-muted-foreground" /></button></div>
        <p className="mb-3 text-sm text-muted-foreground">Choose the certifiers in order (Site Engineer → Independent Engineer → Finance). Each approves in turn.</p>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {approvers.map((a, i) => {
            const idx = sel.indexOf(a.id);
            return (
              <label key={a.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input type="checkbox" checked={idx >= 0} onChange={() => setSel((s) => s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id])} className="h-4 w-4" />
                <span className="flex-1">{a.name}</span>
                {idx >= 0 && <Badge variant="secondary">step {idx + 1}</Badge>}
              </label>
            );
          })}
        </div>
        <div className="mt-3 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} className="gap-1"><Send className="h-4 w-4" /> Send</Button></div>
      </div>
    </div>
  );
}

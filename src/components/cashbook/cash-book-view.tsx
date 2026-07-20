'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Loader2, Plus, ArrowDownLeft, ArrowUpRight, Package, Ban, Wallet, Printer } from 'lucide-react';
import { useAction } from '@/lib/hooks/use-action';
import { createVoucher, cancelVoucher } from '@/server/actions/vouchers';
import { KIND_META, VOUCHER_KINDS, PAY_MODES, PAY_MODE_LABEL, UNITS, type VoucherKind } from '@/config/vouchers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils/cn';

interface Row {
  id: string; number: string; kind: string; status: string; date: string;
  partyName: string; amount: number; mode: string;
  reference: string | null; narration: string | null;
  materialName: string | null; quantity: number | null; unit: string | null;
  cancelReason: string | null;
}

const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const IN_KINDS = new Set(['CASH_RECEIVED', 'BANK_RECEIVED']);
const OUT_KINDS = new Set(['CASH_PAID', 'BANK_PAID']);

export function CashBookView({
  vouchers, projects, month, opening, activeProjectId, canManage,
}: {
  vouchers: Row[];
  projects: { id: string; name: string }[];
  month: string;
  opening: number;
  activeProjectId: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [open, setOpen] = React.useState<VoucherKind | null>(null);
  const [filter, setFilter] = React.useState<string>('all');

  const posted = vouchers.filter((v) => v.status === 'POSTED');
  const cashIn = posted.filter((v) => IN_KINDS.has(v.kind)).reduce((n, v) => n + v.amount, 0);
  const cashOut = posted.filter((v) => OUT_KINDS.has(v.kind)).reduce((n, v) => n + v.amount, 0);
  const materialIn = posted.filter((v) => v.kind === 'MATERIAL_RECEIVED').reduce((n, v) => n + v.amount, 0);
  const closing = opening + cashIn - cashOut;

  const shown = filter === 'all' ? vouchers : vouchers.filter((v) => v.kind === filter);

  return (
    <div className="space-y-4">
      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Opened with" value={money(opening)} icon={Wallet} />
        <Stat label="Received" value={money(cashIn)} icon={ArrowDownLeft} tone="in" />
        <Stat label="Paid out" value={money(cashOut)} icon={ArrowUpRight} tone="out" />
        <Stat label="In hand now" value={money(closing)} icon={Wallet} tone={closing < 0 ? 'out' : undefined} />
      </div>

      {materialIn > 0 && (
        <p className="text-xs text-muted-foreground">
          Material received this month is worth {money(materialIn)}. Material does not move the cash balance.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input type="month" className="h-9 w-40" defaultValue={month}
          onChange={(e) => e.target.value && router.push(`/cash-book?m=${e.target.value}`)} />
        <Button asChild size="sm" variant="outline"><a href={`/api/reports/cash-book.csv?m=${month}`}><Printer className="h-4 w-4" /> Export</a></Button>
        {canManage && (
          <span className="chip-row ml-auto w-full sm:w-auto">
            {VOUCHER_KINDS.map((k) => (
              <Button key={k} size="sm" variant={KIND_META[k].direction === 'in' ? 'default' : 'outline'} onClick={() => setOpen(k)}>
                <Plus className="h-3.5 w-3.5" /> {KIND_META[k].label}
              </Button>
            ))}
          </span>
        )}
      </div>

      <div className="chip-row">
        <button onClick={() => setFilter('all')}
          className={cn('rounded-full border px-3 py-1 text-xs', filter === 'all' && 'border-primary bg-primary text-primary-foreground')}>
          Everything
        </button>
        {VOUCHER_KINDS.map((k) => (
          <button key={k} onClick={() => setFilter(k)}
            className={cn('rounded-full border px-3 py-1 text-xs', filter === k && 'border-primary bg-primary text-primary-foreground')}>
            {KIND_META[k].label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nothing recorded this month"
          body={canManage ? 'Use the buttons above to record the first voucher — cash taken, cash paid, or material delivered to site.' : 'Nothing has been entered for this period.'}
        />
      ) : (
        <Card className="table-scroll">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Voucher</th><th className="p-3">Party</th><th className="p-3">Details</th>
                <th className="p-3 text-right">In</th><th className="p-3 text-right">Out</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((v) => {
                const meta = KIND_META[v.kind as VoucherKind];
                const cancelled = v.status === 'CANCELLED';
                const isIn = IN_KINDS.has(v.kind);
                const isOut = OUT_KINDS.has(v.kind);
                return (
                  <tr key={v.id} className={cn('border-b last:border-0', cancelled && 'opacity-50')}>
                    <td className="p-3">
                      <span className="font-mono text-xs">{v.number}</span>
                      <span className="block text-[11px] text-muted-foreground">{format(new Date(v.date), 'd MMM')}</span>
                      {cancelled && <Badge variant="destructive" className="mt-1 text-[10px]">cancelled</Badge>}
                    </td>
                    <td className="p-3">
                      <span className={cn('font-medium', cancelled && 'line-through')}>{v.partyName}</span>
                      <span className="block text-[11px] text-muted-foreground">{meta?.label ?? v.kind}</span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {v.materialName && <span className="block">{v.materialName}{v.quantity ? ` · ${v.quantity} ${v.unit ?? ''}` : ''}</span>}
                      {v.reference && <span className="block">Ref {v.reference}</span>}
                      {v.narration && <span className="block">{v.narration}</span>}
                      {!v.materialName && <span className="block">{PAY_MODE_LABEL[v.mode] ?? v.mode}</span>}
                      {cancelled && v.cancelReason && <span className="block text-destructive">{v.cancelReason}</span>}
                    </td>
                    <td className="p-3 text-right tabular text-success">{isIn && !cancelled ? money(v.amount) : ''}</td>
                    <td className="p-3 text-right tabular text-destructive">{isOut && !cancelled ? money(v.amount) : ''}</td>
                    <td className="p-3 text-right">
                      {canManage && !cancelled && (
                        <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs text-destructive" disabled={pending}
                          title="Cancel this voucher — it stays in the book, marked cancelled"
                          onClick={() => {
                            const why = window.prompt(`Cancel ${v.number}? Give a reason — it stays in the book either way.`);
                            if (why !== null) run(() => cancelVoucher(v.id, why), 'Cancelled');
                          }}>
                          <Ban className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          {open && (
            <>
              <DialogHeader><DialogTitle>{KIND_META[open].label}</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">{KIND_META[open].hint}</p>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = Object.fromEntries(new FormData(e.currentTarget));
                  run(() => createVoucher({ ...fd, kind: open }), 'Recorded');
                  setOpen(null);
                }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label htmlFor="voucherDate">Date</Label>
                    <Input id="voucherDate" name="voucherDate" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} />
                  </div>
                  <div className="space-y-1.5"><Label htmlFor="projectId">Project</Label>
                    <select id="projectId" name="projectId" defaultValue={activeProjectId ?? ''} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                      <option value="">Not project-specific</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="partyName">{KIND_META[open].partyLabel}</Label>
                  <Input id="partyName" name="partyName" required placeholder="Name of the person or firm" />
                </div>

                {KIND_META[open].isMaterial ? (
                  <>
                    <div className="space-y-1.5"><Label htmlFor="materialName">Material</Label>
                      <Input id="materialName" name="materialName" required placeholder="OPC 53 grade cement" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5"><Label htmlFor="quantity">Quantity</Label><Input id="quantity" name="quantity" type="number" step="0.001" min="0" /></div>
                      <div className="space-y-1.5"><Label htmlFor="unit">Unit</Label>
                        <select id="unit" name="unit" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5"><Label htmlFor="rate">Rate</Label><Input id="rate" name="rate" type="number" step="0.01" min="0" /></div>
                    </div>
                    <p className="text-xs text-muted-foreground">Leave the amount blank and it works itself out from quantity × rate.</p>
                  </>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label htmlFor="amount">Amount (₹)</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" min="0" required={!KIND_META[open].isMaterial} />
                  </div>
                  <div className="space-y-1.5"><Label htmlFor="mode">How</Label>
                    <select id="mode" name="mode" defaultValue={open.startsWith('BANK') ? 'BANK_TRANSFER' : 'CASH'} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                      {PAY_MODES.map((m) => <option key={m} value={m}>{PAY_MODE_LABEL[m]}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reference">Reference <span className="font-normal opacity-70">— UTR, cheque or challan number</span></Label>
                  <Input id="reference" name="reference" placeholder="Optional but worth recording" />
                </div>
                <div className="space-y-1.5"><Label htmlFor="narration">What was it for?</Label><Textarea id="narration" name="narration" rows={2} /></div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(null)}>Cancel</Button>
                  <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Record it</Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ElementType; tone?: 'in' | 'out' }) {
  return (
    <Card className="p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</p>
      <p className={cn('font-display text-xl font-semibold tabular', tone === 'in' && 'text-success', tone === 'out' && 'text-destructive')}>{value}</p>
    </Card>
  );
}

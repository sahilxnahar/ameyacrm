'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, RefreshCw, Trash2, Target, TrendingUp, Wallet, Trophy } from 'lucide-react';
import { setSalesTarget, saveIncentiveSlab, deleteIncentiveSlab, recalculateIncentives, setIncentiveStatus, saveProbabilities } from '@/server/actions/forecast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils/cn';

const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const lakh = (n: number) => (n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1)} L` : money(n));

interface Row { userId: string; name: string; target: number; booked: number; weightedPipeline: number; bookingCount: number; leadCount: number; attainment: number; incentive: number }
interface Slab { id: string; name: string; fromValue: number; toValue: number | null; ratePercent: number; flatAmount: number | null }
interface Entry { id: string; userName: string; baseValue: number; amount: number; slabName: string | null; status: string; note: string | null }

export function ForecastView({
  month, rows, totals, byStage, probabilities, users, slabs, entries, canManage,
}: {
  month: string;
  rows: Row[];
  totals: { target: number; booked: number; weightedPipeline: number; incentive: number };
  byStage: Array<{ stage: string; count: number; value: number; weighted: number; probability: number }>;
  probabilities: Record<string, number>;
  users: { id: string; name: string }[];
  slabs: Slab[];
  entries: Entry[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [tab, setTab] = React.useState<'forecast' | 'incentives'>('forecast');
  const [targetOpen, setTargetOpen] = React.useState(false);
  const [slabOpen, setSlabOpen] = React.useState(false);
  const [probOpen, setProbOpen] = React.useState(false);
  const [prob, setProb] = React.useState(probabilities);

  const run = (fn: () => Promise<{ ok?: true; message?: string } | { error: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if ('error' in r && r.error) { toast.error(r.error); return; }
      toast.success(('message' in r && r.message) || ok);
      router.refresh();
      setTargetOpen(false); setSlabOpen(false); setProbOpen(false);
    });

  const maxStage = Math.max(1, ...byStage.map((s) => s.value));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Target} label="Target this month" value={lakh(totals.target)} />
        <Stat icon={Trophy} label="Booked" value={lakh(totals.booked)} tone={totals.booked >= totals.target && totals.target > 0 ? 'good' : undefined} />
        <Stat icon={TrendingUp} label="Weighted pipeline" value={lakh(totals.weightedPipeline)} hint="Open leads × their stage odds" />
        <Stat icon={Wallet} label="Incentive accrued" value={lakh(totals.incentive)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={tab === 'forecast' ? 'default' : 'outline'} onClick={() => setTab('forecast')}>Forecast & targets</Button>
        <Button size="sm" variant={tab === 'incentives' ? 'default' : 'outline'} onClick={() => setTab('incentives')}>Incentives</Button>
        <Input type="month" className="h-8 w-40" defaultValue={month} onChange={(e) => e.target.value && router.push(`/forecast?m=${e.target.value}`)} />
        {canManage && tab === 'forecast' && (
          <>
            <Button size="sm" variant="outline" onClick={() => setTargetOpen(true)}><Plus className="h-4 w-4" /> Set a target</Button>
            <Button size="sm" variant="outline" onClick={() => setProbOpen(true)}>Stage odds</Button>
          </>
        )}
        {canManage && tab === 'incentives' && (
          <>
            <Button size="sm" variant="outline" onClick={() => setSlabOpen(true)}><Plus className="h-4 w-4" /> Add slab</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => recalculateIncentives(month), 'Recalculated')}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Recalculate
            </Button>
          </>
        )}
      </div>

      {tab === 'forecast' ? (
        <>
          <Card className="p-4">
            <p className="mb-3 text-sm font-semibold">Pipeline by stage</p>
            <div className="space-y-2">
              {byStage.map((s) => (
                <div key={s.stage} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs">{s.stage.replace(/_/g, ' ')}</span>
                  <span className="h-5 flex-1 overflow-hidden rounded bg-secondary">
                    <span className="flex h-full items-center rounded bg-primary/70 px-2 text-[10px] font-medium text-primary-foreground"
                      style={{ width: `${Math.max(4, (s.value / maxStage) * 100)}%` }}>
                      {s.count}
                    </span>
                  </span>
                  <span className="w-24 shrink-0 text-right text-xs">{lakh(s.value)}</span>
                  <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">{s.probability}%</span>
                  <span className="w-24 shrink-0 text-right text-xs font-medium">{lakh(s.weighted)}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Last column is the weighted value — what the stage is realistically worth.</p>
          </Card>

          <Card className="table-scroll">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3">Person</th><th className="p-3 text-right">Target</th><th className="p-3 text-right">Booked</th>
                  <th className="p-3 text-right">Attainment</th><th className="p-3 text-right">Weighted pipeline</th>
                  <th className="p-3 text-right">Open leads</th><th className="p-3 text-right">Incentive</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId} className="border-b last:border-0">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3 text-right text-muted-foreground">{r.target ? lakh(r.target) : '—'}</td>
                    <td className="p-3 text-right font-medium">{lakh(r.booked)}</td>
                    <td className="p-3 text-right">
                      {r.target ? (
                        <Badge variant={r.attainment >= 100 ? 'success' : r.attainment >= 60 ? 'warning' : 'destructive'}>{r.attainment}%</Badge>
                      ) : <span className="text-xs text-muted-foreground">no target</span>}
                    </td>
                    <td className="p-3 text-right">{lakh(r.weightedPipeline)}</td>
                    <td className="p-3 text-right text-muted-foreground">{r.leadCount}</td>
                    <td className="p-3 text-right">{r.incentive ? lakh(r.incentive) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <>
          <Card className="p-4">
            <p className="mb-2 text-sm font-semibold">Commission slabs</p>
            {slabs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No slabs yet. Add one — for example &ldquo;0 to ₹1 Cr → 0.5%&rdquo;.</p>
            ) : (
              <ul className="divide-y">
                {slabs.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      <span className="font-medium">{s.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {lakh(s.fromValue)} – {s.toValue === null ? 'no limit' : lakh(s.toValue)} → {s.ratePercent ? `${s.ratePercent}%` : ''}{s.ratePercent && s.flatAmount ? ' + ' : ''}{s.flatAmount ? money(s.flatAmount) : ''}
                      </span>
                    </span>
                    {canManage && (
                      <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs text-destructive" disabled={pending}
                        title="Retire this slab — existing entries keep their amounts"
                        onClick={() => run(() => deleteIncentiveSlab(s.id), 'Slab retired')}>
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="table-scroll">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="p-3">Person</th><th className="p-3">Booking</th><th className="p-3 text-right">Value</th><th className="p-3">Slab</th><th className="p-3 text-right">Earns</th><th className="p-3">Status</th><th className="p-3"></th></tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{e.userName}</td>
                    <td className="p-3 text-xs text-muted-foreground">{e.note ?? '—'}</td>
                    <td className="p-3 text-right">{lakh(e.baseValue)}</td>
                    <td className="p-3 text-xs">{e.slabName ?? '—'}</td>
                    <td className="p-3 text-right font-medium">{money(e.amount)}</td>
                    <td className="p-3"><Badge variant={e.status === 'PAID' ? 'success' : e.status === 'APPROVED' ? 'secondary' : 'warning'}>{e.status}</Badge></td>
                    <td className="p-3 text-right">
                      {canManage && e.status !== 'PAID' && (
                        <span className="flex justify-end gap-1.5">
                          {e.status === 'ACCRUED' && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pending}
                              title="Lock this amount in — recalculating will no longer change it"
                              onClick={() => run(() => setIncentiveStatus(e.id, 'APPROVED'), 'Approved')}>Approve</Button>
                          )}
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pending}
                            title="Record that this has been paid out"
                            onClick={() => run(() => setIncentiveStatus(e.id, 'PAID'), 'Marked paid')}>Mark paid</Button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No incentives yet. Add a slab, then Recalculate.</td></tr>}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <Dialog open={targetOpen} onOpenChange={setTargetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set a monthly target</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault(); const fd = new FormData(e.currentTarget);
            run(() => setSalesTarget({ userId: fd.get('userId'), month: fd.get('month'), target: fd.get('target'), metric: 'BOOKING_VALUE' }), 'Target saved');
          }}>
            <div className="space-y-1.5"><Label htmlFor="userId">Person</Label>
              <select id="userId" name="userId" required className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="month">Month</Label><Input id="month" name="month" type="month" defaultValue={month} required /></div>
            <div className="space-y-1.5"><Label htmlFor="target">Booking value target (₹)</Label><Input id="target" name="target" type="number" min="0" step="1000" required placeholder="10000000" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setTargetOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={slabOpen} onOpenChange={setSlabOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a commission slab</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault(); const fd = new FormData(e.currentTarget);
            run(() => saveIncentiveSlab(Object.fromEntries(fd)), 'Slab added');
          }}>
            <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" name="name" required placeholder="Standard — up to 1 Cr" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="fromValue">From (₹)</Label><Input id="fromValue" name="fromValue" type="number" min="0" defaultValue="0" /></div>
              <div className="space-y-1.5"><Label htmlFor="toValue">To (₹, blank = no limit)</Label><Input id="toValue" name="toValue" type="number" min="0" /></div>
              <div className="space-y-1.5"><Label htmlFor="ratePercent">Rate (%)</Label><Input id="ratePercent" name="ratePercent" type="number" step="0.01" min="0" defaultValue="0" /></div>
              <div className="space-y-1.5"><Label htmlFor="flatAmount">Flat bonus (₹)</Label><Input id="flatAmount" name="flatAmount" type="number" min="0" /></div>
            </div>
            <p className="text-xs text-muted-foreground">A booking uses the highest slab its value falls into.</p>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setSlabOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Add</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={probOpen} onOpenChange={setProbOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Odds of closing, by stage</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">These drive the weighted pipeline. Start with your own judgement and tighten them as you see real conversion.</p>
          <div className="grid grid-cols-2 gap-3">
            {['NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED'].map((s) => (
              <div key={s} className="space-y-1.5">
                <Label htmlFor={s}>{s.replace(/_/g, ' ')}</Label>
                <Input id={s} type="number" min="0" max="100" value={prob[s] ?? 0} onChange={(e) => setProb({ ...prob, [s]: Number(e.target.value) })} />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setProbOpen(false)}>Cancel</Button><Button disabled={pending} onClick={() => run(() => saveProbabilities(prob), 'Saved')}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint, tone }: { icon: React.ElementType; label: string; value: string; hint?: string; tone?: 'good' }) {
  return (
    <Card className="p-3">
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</p>
      <p className={cn('font-display text-xl font-semibold', tone === 'good' && 'text-success')}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}

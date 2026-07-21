'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Merge, CheckCircle2 } from 'lucide-react';
import { mergeLeads } from '@/server/actions/duplicates';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface DupLead { id: string; reference: string; name: string; email: string | null; phone: string | null; status: string; source: string; owner: string | null; createdAt: string; activities: number; bookings: number }
interface DupGroup { key: string; kind: 'phone' | 'email'; leads: DupLead[] }

export function DuplicatesView({ groups, canMerge }: { groups: DupGroup[]; canMerge: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [primary, setPrimary] = React.useState<Record<string, string>>({});

  const merge = (g: DupGroup) => {
    const keep = primary[g.key] ?? g.leads[0]?.id;
    if (!keep) return;
    const dupes = g.leads.filter((l) => l.id !== keep).map((l) => l.id);
    start(async () => {
      const r = await mergeLeads(keep, dupes);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`Merged — ${r.movedActivities} activities and ${r.movedBookings} bookings moved`);
      router.refresh();
    });
  };

  if (groups.length === 0) return (
    <Card className="p-10 text-center">
      <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
      <p className="text-sm font-medium">No duplicates found</p>
      <p className="text-xs text-muted-foreground">Every lead has a unique phone number and email.</p>
    </Card>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{groups.length} duplicate group{groups.length > 1 ? 's' : ''} found. Pick which record to keep — its history absorbs the rest.</p>
      {groups.map((g) => {
        const keep = primary[g.key] ?? g.leads[0]?.id ?? '';
        return (
          <Card key={`${g.kind}-${g.key}`} className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Matching {g.kind}: <span className="font-mono">{g.key}</span></p>
              {canMerge && <Button size="sm" disabled={pending} onClick={() => merge(g)}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />} Merge {g.leads.length}</Button>}
            </div>
            <div className="space-y-1">
              {g.leads.map((l) => (
                <label key={l.id} className={`flex cursor-pointer items-center gap-3 rounded-md border p-2 text-sm ${keep === l.id ? 'border-primary bg-primary/5' : ''}`}>
                  <input type="radio" name={`primary-${g.key}`} checked={keep === l.id} onChange={() => setPrimary((p) => ({ ...p, [g.key]: l.id }))} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium"><Link href={`/sales/${l.id}`} className="hover:underline">{l.name}</Link> <span className="font-mono text-xs text-muted-foreground">{l.reference}</span></p>
                    <p className="text-xs text-muted-foreground">{l.phone ?? '—'} · {l.email ?? '—'} · {l.owner ?? 'unassigned'} · {new Date(l.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Badge variant="secondary">{l.status}</Badge>
                    <Badge variant="secondary">{l.activities}a / {l.bookings}b</Badge>
                    {keep === l.id && <Badge variant="success">Keep</Badge>}
                  </div>
                </label>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

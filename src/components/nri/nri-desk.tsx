'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Clock, Phone, Mail, CalendarPlus, Loader2 } from 'lucide-react';
import { scheduleFollowUp } from '@/server/actions/sales';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime, titleCase } from '@/lib/utils/format';

interface Lead { id: string; name: string; country: string | null; timezone: string | null; status: string; owner: string | null; phone: string | null; email: string | null; nextFollowUp: string | null }

function localTime(tz: string | null, now: Date): string {
  if (!tz) return '—';
  try { return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(now); }
  catch { return '—'; }
}

export function NriDesk({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const [now, setNow] = React.useState(() => new Date());
  const [pending, start] = React.useTransition();
  const [sched, setSched] = React.useState<Lead | null>(null);

  React.useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);

  const zones = Array.from(new Set(leads.map((l) => l.timezone).filter(Boolean))) as string[];

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const at = String(fd.get('at') || '');
    if (!sched) return;
    start(async () => { const r = await scheduleFollowUp(sched.id, at); if ('error' in r) return toast.error(r.error); toast.success('Follow-up scheduled'); setSched(null); router.refresh(); });
  };

  return (
    <div className="space-y-6">
      {zones.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {zones.map((tz) => (
            <Card key={tz} className="flex items-center gap-2 px-4 py-2">
              <Clock className="h-4 w-4 text-brass" />
              <div><p className="text-sm font-semibold tabular-nums">{localTime(tz, now)}</p><p className="text-[10px] text-muted-foreground">{tz}</p></div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Lead</TableHead><TableHead>Country</TableHead><TableHead>Local time</TableHead><TableHead>Status</TableHead><TableHead>Next follow-up</TableHead><TableHead>Owner</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {leads.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No NRI leads yet. Mark a lead as NRI when creating it.</TableCell></TableRow>}
            {leads.map((l) => (
              <TableRow key={l.id}>
                <TableCell><Link href={`/sales/${l.id}`} className="font-medium hover:text-primary">{l.name}</Link>
                  <div className="flex gap-3 text-[10px] text-muted-foreground">{l.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</span>}{l.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{l.email}</span>}</div>
                </TableCell>
                <TableCell className="text-sm">{l.country ?? '—'}</TableCell>
                <TableCell className="tabular-nums text-sm">{localTime(l.timezone, now)}</TableCell>
                <TableCell><Badge variant="secondary">{titleCase(l.status)}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.nextFollowUp ? formatDateTime(l.nextFollowUp) : '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.owner ?? '—'}</TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => setSched(l)}><CalendarPlus className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!sched} onOpenChange={(o) => !o && setSched(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Schedule follow-up — {sched?.name}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <Input name="at" type="datetime-local" required autoFocus />
            {sched?.timezone && <p className="text-xs text-muted-foreground">Their local time is currently {localTime(sched.timezone, now)} ({sched.timezone}).</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setSched(null)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Schedule</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

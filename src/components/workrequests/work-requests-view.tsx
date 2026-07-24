'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, X, Inbox, Send, Loader2 } from 'lucide-react';
import { raiseWorkRequest, advanceWorkRequest } from '@/server/actions/workrequests';
import { nextStatuses, wrActionLabel, type WRSide, type WRStatus } from '@/lib/workrequests/lifecycle';
import type { WorkRequestRow } from '@/server/services/workrequest-service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field, FormGrid } from '@/components/ui/field';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils/format';

type Tab = 'incoming' | 'outgoing';

export function WorkRequestsView({
  incoming, outgoing, departments, canCreate, canManage,
}: {
  incoming: WorkRequestRow[];
  outgoing: WorkRequestRow[];
  departments: Array<{ id: string; name: string }>;
  canCreate: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>(incoming.length >= outgoing.length ? 'incoming' : 'outgoing');
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();

  const raise = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = Object.fromEntries([...fd.entries()].map(([k, val]) => [k, String(val)])) as Record<string, string>;
    start(async () => {
      const r = await raiseWorkRequest(v);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(r.message); setOpen(false); router.refresh();
    });
  };

  const act = (id: string, to: WRStatus) => {
    start(async () => {
      const r = await advanceWorkRequest(id, to);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(r.message); router.refresh();
    });
  };

  const rows = tab === 'incoming' ? incoming : outgoing;
  const side: WRSide = tab === 'incoming' ? 'receiver' : 'raiser';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border p-0.5">
          <button onClick={() => setTab('incoming')} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${tab === 'incoming' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
            <Inbox className="h-4 w-4" /> To my department ({incoming.length})
          </button>
          <button onClick={() => setTab('outgoing')} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${tab === 'outgoing' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
            <Send className="h-4 w-4" /> Raised by us ({outgoing.length})
          </button>
        </div>
        {canCreate && (
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)} className="ml-auto">
            {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{open ? 'Close' : 'Raise a request'}
          </Button>
        )}
      </div>

      {open && canCreate && (
        <Card className="p-4">
          <form onSubmit={raise}>
            <FormGrid cols={2}>
              <Field label="What do you need?" required><Input name="title" required placeholder="e.g. Verify title for Plot 14" /></Field>
              <Field label="From which department?" required>
                <Select name="toDeptId" required defaultValue="">
                  <option value="" disabled>Choose a department…</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Field>
              <Field label="Priority">
                <Select name="priority" defaultValue="NORMAL">
                  {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p.toLowerCase()}</option>)}
                </Select>
              </Field>
              <Field label="Needed by"><Input name="dueOn" type="date" /></Field>
            </FormGrid>
            <div className="mt-3"><Field label="Details"><textarea name="detail" rows={3} className="focus-ring w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Anything the other team needs to know." /></Field></div>
            <div className="mt-3"><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Send request</Button></div>
          </form>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={tab === 'incoming' ? Inbox : Send}
          title={tab === 'incoming' ? 'No requests to your department' : 'You have not raised any requests'}
          body={tab === 'incoming' ? 'When another team needs something from you, it lands here.' : 'Need something from another department? Raise a request and track it to done.'}
          {...(tab === 'outgoing' && canCreate ? { actionLabel: 'Raise a request', onAction: () => setOpen(true) } : {})}
        />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const moves = (canManage || side === 'raiser') ? nextStatuses(r.status as WRStatus, side) : [];
            return (
              <Card key={r.id} className="p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/work-requests/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.reference} · {r.fromDept ?? 'Someone'} → {r.toDept ?? 'a team'} · {r.priority.toLowerCase()}
                      {r.dueOn ? ` · due ${formatDate(r.dueOn)}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {moves.map((to) => (
                      <Button key={to} size="sm" variant={to === 'REJECTED' || to === 'SENT_BACK' ? 'ghost' : 'outline'} disabled={pending} onClick={() => act(r.id, to)}>
                        {wrActionLabel(to)}
                      </Button>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

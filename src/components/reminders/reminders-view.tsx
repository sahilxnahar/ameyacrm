'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Clock, Trash2, BellPlus, Loader2, BellRing } from 'lucide-react';
import { createReminder, completeReminder, snoozeReminder, deleteReminder } from '@/server/actions/reminders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface Rem { id: string; title: string; notes: string | null; dueAt: string; status: string; leadId: string | null; leadName: string | null }

export function RemindersView({ reminders }: { reminders: Rem[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const act = (fn: () => Promise<{ ok: true } | { error: string }>, msg: string) =>
    start(async () => { const r = await fn(); if ('error' in r) return toast.error(r.error); toast.success(msg); router.refresh(); });

  const add = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form);
    start(async () => {
      const r = await createReminder({ title: fd.get('title'), dueAt: fd.get('dueAt') });
      if ('error' in r) return toast.error(r.error);
      toast.success('Reminder added'); form.reset(); router.refresh();
    });
  };

  const pendingList = reminders.filter((r) => r.status === 'PENDING');
  const done = reminders.filter((r) => r.status !== 'PENDING');
  const overdue = (d: string) => new Date(d) < new Date();

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <Input name="title" placeholder="Remind me to…" required className="min-w-[200px] flex-1" />
          <Input name="dueAt" type="datetime-local" required defaultValue={new Date(Date.now() + 3600000).toISOString().slice(0, 16)} className="w-auto" />
          <Button type="submit" size="sm" disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellPlus className="h-4 w-4" />} Add</Button>
        </form>
      </Card>

      <Card className="divide-y">
        {pendingList.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nothing pending. 🎉</p>}
        {pendingList.map((r) => (
          <div key={r.id} className="flex items-start gap-3 p-3">
            <BellRing className={`mt-0.5 h-4 w-4 shrink-0 ${overdue(r.dueAt) ? 'text-destructive' : 'text-primary'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{r.title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(r.dueAt).toLocaleString('en-IN')}
                {r.leadId && <> · <Link href={`/sales/${r.leadId}`} className="text-primary hover:underline">{r.leadName ?? 'lead'}</Link></>}
              </p>
              {r.notes && <p className="mt-0.5 text-xs text-foreground/70">{r.notes}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {overdue(r.dueAt) && <Badge variant="destructive">Overdue</Badge>}
              <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={pending} onClick={() => act(() => snoozeReminder(r.id, 60), 'Snoozed 1 hour')}><Clock className="h-3 w-3" /> 1h</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-success" disabled={pending} onClick={() => act(() => completeReminder(r.id), 'Done')}><Check className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={pending} onClick={() => act(() => deleteReminder(r.id), 'Deleted')}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </Card>

      {done.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Completed</p>
          <Card className="divide-y opacity-70">
            {done.slice(0, 20).map((r) => (
              <div key={r.id} className="flex items-center justify-between p-2 text-sm">
                <span className="line-through">{r.title}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => act(() => deleteReminder(r.id), 'Deleted')}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

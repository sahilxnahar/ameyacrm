'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { BellPlus, Loader2 } from 'lucide-react';
import { createReminder } from '@/server/actions/reminders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ReminderButton({ leadId, leadName }: { leadId: string; leadName: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createReminder({ title: fd.get('title'), dueAt: fd.get('dueAt'), notes: fd.get('notes') || undefined, leadId });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Reminder set'); setOpen(false); router.refresh();
    });
  };
  const soon = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16);
  return (
    <>
      <Button size="sm" variant="outline" className="mt-2" onClick={() => setOpen(true)}><BellPlus className="h-4 w-4" /> Remind me</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Set a reminder</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1"><Label htmlFor="title">What for?</Label><Input id="title" name="title" required defaultValue={`Follow up with ${leadName}`} /></div>
            <div className="space-y-1"><Label htmlFor="dueAt">When</Label><Input id="dueAt" name="dueAt" type="datetime-local" required defaultValue={soon} /></div>
            <div className="space-y-1"><Label htmlFor="notes">Notes</Label><Input id="notes" name="notes" placeholder="Optional" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Set reminder</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

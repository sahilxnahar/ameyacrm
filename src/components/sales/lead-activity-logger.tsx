'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
import { logLeadActivity } from '@/server/actions/sales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { titleCase } from '@/lib/utils/format';

const TYPES = ['CALL', 'MEETING', 'SITE_VISIT', 'NOTE', 'EMAIL', 'WHATSAPP', 'DOCUMENT'];
const selectCls = 'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm';

export function LeadActivityLogger({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [open, setOpen] = React.useState(false);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await logLeadActivity({ leadId, type: fd.get('type'), subject: fd.get('subject'), notes: fd.get('notes') });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Activity logged'); (e.target as HTMLFormElement).reset(); setOpen(false); router.refresh();
    });
  };

  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Log activity</Button>;
  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border bg-secondary/30 p-4">
      <div className="grid grid-cols-2 gap-3">
        <select name="type" className={selectCls} defaultValue="CALL">{TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select>
        <Input name="subject" placeholder="Subject" required />
      </div>
      <Textarea name="notes" placeholder="Notes / outcome…" className="min-h-[60px]" />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save</Button>
      </div>
    </form>
  );
}

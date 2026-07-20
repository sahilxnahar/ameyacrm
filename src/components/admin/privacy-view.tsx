'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Download, Trash2, Plus, ShieldCheck } from 'lucide-react';
import { createDataRequest, gatherPersonalData, erasePersonalData, setDataRequestStatus, saveRetentionPolicy } from '@/server/actions/dpdp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Req { id: string; reference: string; type: string; status: string; subjectName: string; subjectEmail: string; details: string | null; createdAt: string }

export function PrivacyView({
  requests, retentionMonths, consented, totalLeads,
}: {
  requests: Req[]; retentionMonths: number; consented: number; totalLeads: number;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [months, setMonths] = React.useState(retentionMonths);
  const [lookup, setLookup] = React.useState('');

  const run = (fn: () => Promise<{ ok?: true; message?: string } | { error: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if ('error' in r && r.error) return toast.error(r.error);
      toast.success(('message' in r && r.message) || ok);
      router.refresh(); setOpen(false);
    });

  const exportData = () =>
    start(async () => {
      if (!lookup.trim()) return toast.error('Enter the person’s email address first.');
      const r = await gatherPersonalData(lookup.trim());
      if ('error' in r) return toast.error(r.error);
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `personal-data-${lookup.trim().replace(/[^a-z0-9]/gi, '-')}.json`;
      a.click();
      toast.success('Downloaded. Send this file to the person who asked.');
    });

  const erase = () =>
    start(async () => {
      if (!lookup.trim()) return toast.error('Enter the person’s email address first.');
      const reason = window.prompt(`Erase everything held about ${lookup.trim()}?\n\nThis cannot be undone. Type a reason to confirm:`);
      if (!reason) return;
      const r = await erasePersonalData(lookup.trim(), reason);
      if ('error' in r) return toast.error(r.error);
      toast.success(r.message ?? 'Erased');
      router.refresh();
    });

  const pct = totalLeads ? Math.round((consented / totalLeads) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Leads with recorded consent</p>
          <p className="font-display text-2xl font-semibold">{pct}%</p>
          <p className="text-[11px] text-muted-foreground">{consented} of {totalLeads}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Retention</p>
          <div className="mt-1 flex items-center gap-2">
            <Input type="number" min={12} max={240} className="h-8 w-20" value={months} onChange={(e) => setMonths(Number(e.target.value))} />
            <span className="text-xs">months</span>
            <Button size="sm" variant="outline" className="h-8" disabled={pending} onClick={() => run(() => saveRetentionPolicy(months), 'Saved')}>Save</Button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">How long lost leads are kept before deletion.</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Open requests</p>
          <p className="font-display text-2xl font-semibold">{requests.filter((r) => r.status !== 'COMPLETED' && r.status !== 'REJECTED').length}</p>
        </Card>
      </div>

      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" /> Act on a request</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Under the DPDP Act a person can ask to see everything you hold about them, or to have it erased. Enter their email and use one of the buttons.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-52 flex-1 space-y-1.5">
            <Label htmlFor="lookup">Their email address</Label>
            <Input id="lookup" value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="person@example.com" />
          </div>
          <Button variant="outline" disabled={pending} onClick={exportData} title="Download everything the CRM holds about this person as a file">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export their data
          </Button>
          <Button variant="outline" className="text-destructive" disabled={pending} onClick={erase} title="Permanently remove their personal details">
            <Trash2 className="h-4 w-4" /> Erase them
          </Button>
          <Button variant="outline" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Log a request</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Erasing anonymises financial records rather than deleting them — Indian tax law requires those to be kept, and the DPDP Act allows it.
        </p>
      </Card>

      <Card className="table-scroll">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-3">Ref</th><th className="p-3">Person</th><th className="p-3">Type</th><th className="p-3">Received</th><th className="p-3">Status</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-3 font-mono text-xs">{r.reference}</td>
                <td className="p-3">{r.subjectName}<span className="block text-xs text-muted-foreground">{r.subjectEmail}</span></td>
                <td className="p-3"><Badge variant="secondary">{r.type}</Badge></td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                <td className="p-3"><Badge variant={r.status === 'COMPLETED' ? 'success' : r.status === 'REJECTED' ? 'destructive' : 'warning'}>{r.status.replace(/_/g, ' ')}</Badge></td>
                <td className="p-3 text-right">
                  {r.status !== 'COMPLETED' && (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pending}
                      onClick={() => run(() => setDataRequestStatus(r.id, 'COMPLETED'), 'Marked complete')}>Mark done</Button>
                  )}
                </td>
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No requests logged. Record them here as they arrive — the log is your evidence of compliance.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log a data request</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => createDataRequest(Object.fromEntries(new FormData(e.currentTarget))), 'Logged'); }}>
            <div className="space-y-1.5"><Label htmlFor="type">What are they asking for?</Label>
              <select id="type" name="type" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="EXPORT">A copy of their data</option>
                <option value="DELETE">Erasure</option>
                <option value="CORRECTION">A correction</option>
              </select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="subjectName">Their name</Label><Input id="subjectName" name="subjectName" required /></div>
            <div className="space-y-1.5"><Label htmlFor="subjectEmail">Their email</Label><Input id="subjectEmail" name="subjectEmail" type="email" required /></div>
            <div className="space-y-1.5"><Label htmlFor="details">Notes</Label><Textarea id="details" name="details" rows={3} placeholder="How they contacted you, what exactly they asked for" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Log it</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

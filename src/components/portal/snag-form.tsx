'use client';
import * as React from 'react';
import { Loader2, CheckCircle2, Wrench } from 'lucide-react';
import { submitSnag } from '@/server/actions/portal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function SnagForm({ token }: { token: string }) {
  const [pending, start] = React.useTransition();
  const [done, setDone] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErr(null); const form = e.currentTarget; const fd = new FormData(form);
    start(async () => {
      const r = await submitSnag({ token, title: fd.get('title'), description: fd.get('description') || undefined, category: fd.get('category') || undefined, priority: fd.get('priority') || 'MEDIUM' });
      if ('error' in r) return setErr(r.error);
      form.reset(); setDone(true);
    });
  };

  if (done) return (
    <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-center text-sm">
      <CheckCircle2 className="mx-auto mb-1 h-6 w-6 text-emerald-600" />
      Thanks — your issue has been logged. Our team will follow up.
      <div className="mt-2"><Button size="sm" variant="outline" onClick={() => setDone(false)}>Report another</Button></div>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label htmlFor="title">Issue *</Label><Input id="title" name="title" required placeholder="e.g. Scratched window glass" /></div>
        <div className="space-y-1"><Label htmlFor="category">Area</Label><Input id="category" name="category" placeholder="Kitchen, bathroom…" /></div>
      </div>
      <div className="space-y-1"><Label htmlFor="priority">Priority</Label>
        <select id="priority" name="priority" defaultValue="MEDIUM" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></div>
      <div className="space-y-1"><Label htmlFor="description">Details</Label><Input id="description" name="description" placeholder="Describe the issue" /></div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}<Wrench className="h-4 w-4" /> Submit issue</Button>
    </form>
  );
}

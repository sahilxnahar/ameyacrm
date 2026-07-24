'use client';
import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, UserPlus } from 'lucide-react';
import { checkInVisitor } from '@/server/actions/site-visit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export function CheckInForm({ projects }: { projects: { id: string; name: string }[] }) {
  const [done, setDone] = React.useState<{ id: string; reference: string; name: string } | null>(null);
  const [pending, start] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const name = String(fd.get('name') || '');
    start(async () => {
      const r = await checkInVisitor({ name, phone: fd.get('phone'), email: fd.get('email') || '', projectId: fd.get('projectId') || null, requirement: fd.get('requirement') || undefined, budget: fd.get('budget') || undefined, sourceNote: fd.get('sourceNote') || undefined });
      if ('error' in r) { toast.error(r.error); return; }
      setDone({ id: r.id, reference: r.reference, name });
    });
  };

  if (done) return (
    <Card><CardContent className="space-y-4 p-8 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
      <div><p className="text-lg font-semibold">Welcome, {done.name}!</p><p className="text-sm text-muted-foreground">Checked in as <b>{done.reference}</b>. A sales rep has been notified.</p></div>
      <div className="flex justify-center gap-2">
        <Button onClick={() => setDone(null)}><UserPlus className="h-4 w-4" /> Check in next visitor</Button>
        <Button asChild variant="outline"><Link href={`/sales/${done.id}`}>Open lead</Link></Button>
      </div>
    </CardContent></Card>
  );

  return (
    <Card><CardContent className="p-6">
      <form ref={formRef} onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1"><Label htmlFor="name">Full name *</Label><Input id="name" name="name" required autoFocus /></div>
          <div className="space-y-1"><Label htmlFor="phone">Phone *</Label><Input id="phone" name="phone" required inputMode="tel" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" /></div>
          <div className="space-y-1"><Label htmlFor="projectId">Interested project</Label>
            <select id="projectId" name="projectId" defaultValue="" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1"><Label htmlFor="budget">Budget (₹)</Label><Input id="budget" name="budget" type="number" min="0" placeholder="e.g. 15000000" /></div>
          <div className="space-y-1"><Label htmlFor="sourceNote">How did you hear about us?</Label><Input id="sourceNote" name="sourceNote" placeholder="Hoarding on ORR, Newspaper…" /></div>
        </div>
        <div className="space-y-1"><Label htmlFor="requirement">Requirement</Label><Input id="requirement" name="requirement" placeholder="3BHK, park-facing, ready to move…" /></div>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Check in visitor</Button>
      </form>
    </CardContent></Card>
  );
}

'use client';
import * as React from 'react';
import { Loader2, CheckCircle2, UserPlus } from 'lucide-react';
import { cpRegisterLead } from '@/server/actions/cp-portal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CpLeadForm({ token }: { token: string }) {
  const [pending, start] = React.useTransition();
  const [done, setDone] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErr(null);
    const form = e.currentTarget; const fd = new FormData(form);
    start(async () => {
      const r = await cpRegisterLead({ token, name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email') || undefined, requirement: fd.get('requirement') || undefined });
      if ('error' in r) { setErr(r.error); return; }
      form.reset(); setDone(true);
    });
  };

  if (done) return (
    <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-center text-sm">
      <CheckCircle2 className="mx-auto mb-1 h-6 w-6 text-emerald-600" />
      Client registered and locked to you for 60 days. Our sales team will follow up.
      <div className="mt-2"><Button size="sm" variant="outline" onClick={() => setDone(false)}>Register another</Button></div>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="name">Client name *</Label><Input id="name" name="name" required placeholder="Full name" /></div>
        <div className="space-y-1"><Label htmlFor="phone">Phone *</Label><Input id="phone" name="phone" required placeholder="10-digit mobile" /></div>
        <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" placeholder="optional" /></div>
        <div className="space-y-1"><Label htmlFor="requirement">Requirement</Label><Input id="requirement" name="requirement" placeholder="e.g. 3BHK, budget ₹1.2Cr" /></div>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}<UserPlus className="h-4 w-4" /> Register client</Button>
    </form>
  );
}

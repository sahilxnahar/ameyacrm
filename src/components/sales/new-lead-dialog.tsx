'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { createLead } from '@/server/actions/sales';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const selectCls = 'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function NewLeadDialog({
  open, onOpenChange, users, projects,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  users: { id: string; name: string }[]; projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [isNri, setIsNri] = React.useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await createLead({
        name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone'),
        source: fd.get('source'), requirement: fd.get('requirement'),
        budgetMin: fd.get('budgetMin') || undefined, budgetMax: fd.get('budgetMax') || undefined,
        projectId: fd.get('projectId') || null, ownerId: fd.get('ownerId') || null,
        isNri, country: fd.get('country') || undefined, timezone: fd.get('timezone') || undefined,
      });
      if ('error' in res) { toast.error(res.error); return; }
      toast.success('Lead created');
      onOpenChange(false); setIsNri(false); router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>New lead</DialogTitle><DialogDescription>Capture a new inquiry.</DialogDescription></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" required /></div>
            <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" /></div>
            <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" /></div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <select id="source" name="source" className={selectCls} defaultValue="WEBSITE">
                {['WEBSITE','REFERRAL','WALK_IN','CAMPAIGN','PORTAL','NRI_DESK','BROKER','OTHER'].map((s) => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
              </select>
            </div>
            <div className="space-y-2"><Label htmlFor="budgetMin">Budget min (₹)</Label><Input id="budgetMin" name="budgetMin" type="number" /></div>
            <div className="space-y-2"><Label htmlFor="budgetMax">Budget max (₹)</Label><Input id="budgetMax" name="budgetMax" type="number" /></div>
            <div className="space-y-2">
              <Label htmlFor="projectId">Project</Label>
              <select id="projectId" name="projectId" className={selectCls} defaultValue=""><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerId">Owner</Label>
              <select id="ownerId" name="ownerId" className={selectCls} defaultValue=""><option value="">Me</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            </div>
          </div>
          <div className="space-y-2"><Label htmlFor="requirement">Requirement</Label><Textarea id="requirement" name="requirement" placeholder="e.g. 3BHK, high floor, east-facing" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isNri} onChange={(e) => setIsNri(e.target.checked)} className="accent-[hsl(var(--primary))]" /> NRI lead</label>
          {isNri && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="country">Country</Label><Input id="country" name="country" placeholder="e.g. UAE" /></div>
              <div className="space-y-2"><Label htmlFor="timezone">Time zone</Label><Input id="timezone" name="timezone" placeholder="e.g. Asia/Dubai" /></div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Create lead</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

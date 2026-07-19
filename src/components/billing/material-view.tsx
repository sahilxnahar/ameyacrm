'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Mail, Check, X } from 'lucide-react';
import { createMaterialRequest, decideMaterialRequest } from '@/server/actions/material';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, titleCase } from '@/lib/utils/format';

const selectCls = 'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm';
interface Opt { id: string; name: string }
interface Req { id: string; reference: string; title: string; status: string; priority: string; requester: string; department: string | null; project: string | null; items: number; emailStatus: string | null; recipient: string | null; createdAt: string; needsMyApproval: boolean }
const COMMON = ['Cement', 'Steel', 'Electrical Items', 'Tiles', 'Plumbing Material', 'Furniture', 'Office Supplies'];

export function MaterialView({ requests, projects, departments, approvers, canApprove }: { requests: Req[]; projects: Opt[]; departments: Opt[]; approvers: Opt[]; canApprove: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [items, setItems] = React.useState([{ material: '', quantity: '', unit: 'nos', spec: '' }]);
  const [approverIds, setApproverIds] = React.useState<string[]>([]);

  const decide = (id: string, decision: 'APPROVED' | 'REJECTED') =>
    start(async () => {
      const res = await decideMaterialRequest(id, decision);
      if ('error' in res) return toast.error(res.error);
      toast.success(`Request ${decision.toLowerCase()}`); router.refresh();
    });

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await createMaterialRequest({
        title: fd.get('title'), projectId: fd.get('projectId') || null, departmentId: fd.get('departmentId') || null,
        priority: fd.get('priority'), neededBy: fd.get('neededBy') || null, notes: fd.get('notes'),
        recipientEmail: fd.get('recipientEmail'), approverIds,
        items: items.filter((i) => i.material && i.quantity).map((i) => ({ material: i.material, quantity: Number(i.quantity), unit: i.unit, spec: i.spec })),
      });
      if ('error' in res) return toast.error(res.error);
      toast.success('Request raised & email generated');
      setOpen(false); setItems([{ material: '', quantity: '', unit: 'nos', spec: '' }]); setApproverIds([]); router.refresh();
    });
  };

  return (
    <div>
      <div className="mb-4 flex justify-end"><Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New request</Button></div>
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Ref</TableHead><TableHead>Title</TableHead><TableHead>Requester</TableHead>
            <TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Email</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {requests.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No requests yet.</TableCell></TableRow>}
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.reference}</TableCell>
                <TableCell><p className="font-medium">{r.title}</p><p className="text-xs text-muted-foreground">{r.items} items · {r.department ?? '—'}</p></TableCell>
                <TableCell className="text-sm">{r.requester}</TableCell>
                <TableCell><Badge variant={r.priority === 'URGENT' ? 'destructive' : r.priority === 'HIGH' ? 'warning' : 'secondary'}>{titleCase(r.priority)}</Badge></TableCell>
                <TableCell><Badge variant={r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'destructive' : 'default'}>{titleCase(r.status)}</Badge></TableCell>
                <TableCell>{r.emailStatus && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{titleCase(r.emailStatus)}</span>}</TableCell>
                <TableCell>
                  {canApprove && r.needsMyApproval && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-success" onClick={() => decide(r.id, 'APPROVED')}><Check className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => decide(r.id, 'REJECTED')}><X className="h-4 w-4" /></Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>New material request</DialogTitle><DialogDescription>Generates a structured email and routes for approval.</DialogDescription></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="title">Title</Label><Input id="title" name="title" required placeholder="e.g. Tower A slab — cement & steel" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="projectId">Project</Label><select id="projectId" name="projectId" className={selectCls} defaultValue=""><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="departmentId">Department</Label><select id="departmentId" name="departmentId" className={selectCls} defaultValue=""><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="priority">Priority</Label><select id="priority" name="priority" className={selectCls} defaultValue="MEDIUM">{['LOW','MEDIUM','HIGH','URGENT'].map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="neededBy">Needed by</Label><Input id="neededBy" name="neededBy" type="date" /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="recipientEmail">Recipient email</Label><Input id="recipientEmail" name="recipientEmail" type="email" required placeholder="purchase@vendor.com" /></div>

            <div className="space-y-2">
              <Label>Materials</Label>
              {items.map((it, idx) => (
                <div key={idx} className="flex gap-2">
                  <input list="materials" className={selectCls + ' flex-[2]'} placeholder="Material" value={it.material} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, material: e.target.value } : x))} />
                  <Input className="w-20" placeholder="Qty" type="number" value={it.quantity} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} />
                  <Input className="w-20" placeholder="Unit" value={it.unit} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x))} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <datalist id="materials">{COMMON.map((m) => <option key={m} value={m} />)}</datalist>
              <Button type="button" variant="outline" size="sm" onClick={() => setItems((p) => [...p, { material: '', quantity: '', unit: 'nos', spec: '' }])}><Plus className="h-4 w-4" /> Add line</Button>
            </div>

            <div className="space-y-2">
              <Label>Approvers</Label>
              <div className="flex flex-wrap gap-2">
                {approvers.map((a) => (
                  <label key={a.id} className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${approverIds.includes(a.id) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
                    <input type="checkbox" className="hidden" checked={approverIds.includes(a.id)} onChange={(e) => setApproverIds((p) => e.target.checked ? [...p, a.id] : p.filter((id) => id !== a.id))} />
                    {a.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Raise request</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

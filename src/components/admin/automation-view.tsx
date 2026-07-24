'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Zap, Play } from 'lucide-react';
import { createAutomationRule, updateAutomationRule, toggleAutomationRule, deleteAutomationRule } from '@/server/actions/automation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { timeAgo, titleCase } from '@/lib/utils/format';

const sel = 'h-9 rounded-md border border-input bg-background px-2 text-sm';
const TRIGGERS = ['LEAD_CREATED', 'LEAD_STAGE_CHANGED', 'TASK_CREATED', 'TASK_STATUS_CHANGED'];
const FIELDS = ['source', 'status', 'score', 'isNri', 'country', 'name', 'email'];
const OPS = [['eq', 'is'], ['neq', 'is not'], ['contains', 'contains'], ['gt', '>'], ['lt', '<'], ['is_true', 'is true'], ['is_false', 'is false']];
const STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'WON', 'LOST'];
const ACTION_TYPES = [
  ['ASSIGN_ROUND_ROBIN', 'Assign (round-robin)'], ['ASSIGN_USER', 'Assign to user'],
  ['NOTIFY_USER', 'Notify user'], ['CREATE_TASK', 'Create task'],
  ['SEND_EMAIL_TEMPLATE', 'Send email template'], ['UPDATE_LEAD_STATUS', 'Update lead status'],
];
interface Opt { id: string; name: string }
interface Cond { field: string; op: string; value: string }
interface Act { type: string; params: Record<string, unknown> }
interface Rule { id: string; name: string; description: string | null; trigger: string; isActive: boolean; runCount: number; conditions: unknown[]; actions: unknown[] }

export function AutomationView({ rules, runs, users, templates }: {
  rules: Rule[]; runs: { id: string; rule: string; status: string; entityType: string | null; createdAt: string }[];
  users: Opt[]; templates: { key: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Rule | null>(null);
  const [name, setName] = React.useState('');
  const [trigger, setTrigger] = React.useState('LEAD_CREATED');
  const [conds, setConds] = React.useState<Cond[]>([]);
  const [acts, setActs] = React.useState<Act[]>([{ type: 'ASSIGN_ROUND_ROBIN', params: {} }]);

  const openNew = () => { setEditing(null); setName(''); setTrigger('LEAD_CREATED'); setConds([]); setActs([{ type: 'ASSIGN_ROUND_ROBIN', params: {} }]); setOpen(true); };
  const openEdit = (r: Rule) => { setEditing(r); setName(r.name); setTrigger(r.trigger); setConds((r.conditions as Cond[]) ?? []); setActs((r.actions as Act[]) ?? [{ type: 'ASSIGN_ROUND_ROBIN', params: {} }]); setOpen(true); };

  const setActParam = (i: number, key: string, val: unknown) => setActs((p) => p.map((a, j) => j === i ? { ...a, params: { ...a.params, [key]: val } } : a));

  const save = () => {
    const payload = { name, trigger, isActive: editing?.isActive ?? true, conditions: conds.filter((c) => c.field), actions: acts };
    start(async () => {
      const r = editing ? await updateAutomationRule(editing.id, payload) : await createAutomationRule(payload);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(editing ? 'Rule updated' : 'Rule created'); setOpen(false); router.refresh();
    });
  };
  const toggle = (id: string, v: boolean) => start(async () => { const r = await toggleAutomationRule(id, v); if ('error' in r) { toast.error(r.error); return; } router.refresh(); });
  const remove = (id: string) => start(async () => { const r = await deleteAutomationRule(id); if ('error' in r) { toast.error(r.error); return; } toast.success('Deleted'); router.refresh(); });

  return (
    <div className="space-y-6">
      <div className="flex justify-end"><Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> New rule</Button></div>

      <div className="grid gap-3">
        {rules.length === 0 && <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No automations yet. Create your first — e.g. "When a lead is created, assign round-robin and notify."</CardContent></Card>}
        {rules.map((r) => (
          <Card key={r.id}><CardContent className="flex items-center gap-4 p-4">
            <Zap className={`h-5 w-5 ${r.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">{titleCase(r.trigger)} · {(r.conditions as unknown[]).length} condition(s) · {(r.actions as unknown[]).length} action(s) · ran {r.runCount}×</p>
            </div>
            <Switch checked={r.isActive} onCheckedChange={(v) => toggle(r.id, v)} />
            <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Edit</Button>
            <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
          </CardContent></Card>
        ))}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold"><Play className="mr-1 inline h-4 w-4" /> Recent runs</h3>
        <Card><Table>
          <TableHeader><TableRow><TableHead>Rule</TableHead><TableHead>Entity</TableHead><TableHead>Result</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
          <TableBody>
            {runs.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">No runs yet.</TableCell></TableRow>}
            {runs.map((r) => (<TableRow key={r.id}><TableCell className="font-medium">{r.rule}</TableCell><TableCell className="text-sm text-muted-foreground">{r.entityType ?? '—'}</TableCell><TableCell><Badge variant={r.status === 'SUCCESS' ? 'success' : r.status === 'FAILED' ? 'destructive' : 'secondary'}>{titleCase(r.status)}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</TableCell></TableRow>))}
          </TableBody>
        </Table></Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'New'} automation</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Speed-to-lead" /></div>
            <div className="space-y-2"><Label>When (trigger)</Label>
              <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className={sel + ' w-full'}>{TRIGGERS.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select>
            </div>

            <div className="space-y-2">
              <Label>If (conditions — all must match)</Label>
              {conds.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <select value={c.field} className={sel} onChange={(e) => setConds((p) => p.map((x, j) => j === i ? { ...x, field: e.target.value } : x))}>{FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}</select>
                  <select value={c.op} className={sel} onChange={(e) => setConds((p) => p.map((x, j) => j === i ? { ...x, op: e.target.value } : x))}>{OPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  <Input className="flex-1" value={c.value} onChange={(e) => setConds((p) => p.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="value" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setConds((p) => p.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setConds((p) => [...p, { field: 'source', op: 'eq', value: '' }])}><Plus className="h-4 w-4" /> Add condition</Button>
            </div>

            <div className="space-y-2">
              <Label>Then (actions)</Label>
              {acts.map((a, i) => (
                <div key={i} className="space-y-2 rounded-md border p-2">
                  <div className="flex gap-2">
                    <select value={a.type} className={sel + ' flex-1'} onChange={(e) => setActs((p) => p.map((x, j) => j === i ? { type: e.target.value, params: {} } : x))}>{ACTION_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setActs((p) => p.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  {a.type === 'ASSIGN_ROUND_ROBIN' && (
                    <div className="flex flex-wrap gap-1">{users.map((u) => { const ids = (a.params.userIds as string[]) ?? []; const on = ids.includes(u.id); return (
                      <button key={u.id} type="button" onClick={() => setActParam(i, 'userIds', on ? ids.filter((x) => x !== u.id) : [...ids, u.id])} className={`rounded-full border px-2 py-0.5 text-xs ${on ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}>{u.name}</button>); })}</div>
                  )}
                  {a.type === 'ASSIGN_USER' && <select className={sel + ' w-full'} value={(a.params.userId as string) ?? ''} onChange={(e) => setActParam(i, 'userId', e.target.value)}><option value="">Select user…</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}
                  {a.type === 'NOTIFY_USER' && <div className="flex gap-2"><select className={sel} value={(a.params.userId as string) ?? ''} onChange={(e) => setActParam(i, 'userId', e.target.value)}><option value="">User…</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select><Input className="flex-1" placeholder="Message" value={(a.params.title as string) ?? ''} onChange={(e) => setActParam(i, 'title', e.target.value)} /></div>}
                  {a.type === 'CREATE_TASK' && <div className="grid grid-cols-2 gap-2"><Input placeholder="Task title" value={(a.params.title as string) ?? ''} onChange={(e) => setActParam(i, 'title', e.target.value)} /><Input type="number" placeholder="Due in days" value={(a.params.dueInDays as string) ?? ''} onChange={(e) => setActParam(i, 'dueInDays', e.target.value)} /><select className={sel} value={(a.params.assigneeId as string) ?? ''} onChange={(e) => setActParam(i, 'assigneeId', e.target.value)}><option value="">Assignee (optional)</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>}
                  {a.type === 'SEND_EMAIL_TEMPLATE' && <div className="flex gap-2"><select className={sel} value={(a.params.templateKey as string) ?? ''} onChange={(e) => setActParam(i, 'templateKey', e.target.value)}><option value="">Template…</option>{templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</select><Input className="flex-1" placeholder="To (email, or 'lead')" value={(a.params.to as string) ?? 'lead'} onChange={(e) => setActParam(i, 'to', e.target.value)} /></div>}
                  {a.type === 'UPDATE_LEAD_STATUS' && <select className={sel + ' w-full'} value={(a.params.status as string) ?? ''} onChange={(e) => setActParam(i, 'status', e.target.value)}><option value="">Status…</option>{STATUSES.map((st) => <option key={st} value={st}>{titleCase(st)}</option>)}</select>}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setActs((p) => [...p, { type: 'NOTIFY_USER', params: {} }])}><Plus className="h-4 w-4" /> Add action</Button>
            </div>

            <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={pending || !name}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? 'Save' : 'Create'} rule</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

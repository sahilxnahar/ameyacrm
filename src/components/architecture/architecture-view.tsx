'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, Download, History, MessageSquareReply, Check } from 'lucide-react';
import { createDrawing, createRFI, answerRFI, createIssue, updateIssueStatus, createConsultant } from '@/server/actions/architecture';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDate, titleCase } from '@/lib/utils/format';

const selectCls = 'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm';
const ISTATUS = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
interface Opt { id: string; name: string }
interface Consultant { id: string; name: string; firm: string | null; discipline: string | null; email: string | null }
interface Drawing { id: string; number: string; title: string; discipline: string; status: string; revision: number; project: string | null; fileId: string | null }
interface Rfi { id: string; number: string; subject: string; question: string; response: string | null; status: string; assignedTo: string | null; consultant: string | null; dueDate: string | null }
interface Issue { id: string; title: string; severity: string; status: string; assignedTo: string | null; project: string | null }
function sevVariant(s: string) { return s === 'CRITICAL' ? 'destructive' : s === 'HIGH' ? 'warning' : s === 'LOW' ? 'secondary' : 'default'; }

export function ArchitectureView({ drawings, rfis, issues, consultants, projects, users }: {
  drawings: Drawing[]; rfis: Rfi[]; issues: Issue[]; consultants: Consultant[]; projects: Opt[]; users: Opt[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [d, setD] = React.useState<null | 'drawing' | 'rfi' | 'issue' | 'consultant'>(null);
  const close = () => setD(null);
  const run = (fn: () => Promise<{ ok: true; id: string } | { error: string }>, ok: string) =>
    start(async () => { const r = await fn(); if ('error' in r) return toast.error(r.error); toast.success(ok); close(); router.refresh(); });

  const submitDrawing = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget); run(() => createDrawing(fd), 'Drawing created'); };
  const answer = (r: Rfi) => { const resp = prompt(`Answer RFI ${r.number}:`); if (resp) run(() => answerRFI(r.id, resp), 'RFI answered'); };
  const setIssue = (id: string, status: string) => start(async () => { const r = await updateIssueStatus(id, status as never); if ('error' in r) return toast.error(r.error); toast.success('Updated'); router.refresh(); });

  return (
    <Tabs defaultValue="drawings">
      <div className="mb-4 flex items-center justify-between">
        <TabsList><TabsTrigger value="drawings">Drawings</TabsTrigger><TabsTrigger value="rfis">RFIs</TabsTrigger><TabsTrigger value="issues">Issues</TabsTrigger><TabsTrigger value="consultants">Consultants</TabsTrigger></TabsList>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setD('consultant')}><Plus className="h-4 w-4" /> Consultant</Button>
          <Button size="sm" variant="outline" onClick={() => setD('issue')}><Plus className="h-4 w-4" /> Issue</Button>
          <Button size="sm" variant="outline" onClick={() => setD('rfi')}><Plus className="h-4 w-4" /> RFI</Button>
          <Button size="sm" onClick={() => setD('drawing')}><Plus className="h-4 w-4" /> Drawing</Button>
        </div>
      </div>

      <TabsContent value="drawings">
        <Card><Table>
          <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Title</TableHead><TableHead>Discipline</TableHead><TableHead>Rev</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {drawings.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No drawings yet.</TableCell></TableRow>}
            {drawings.map((dr) => (
              <TableRow key={dr.id}>
                <TableCell className="font-mono text-xs">{dr.number}</TableCell>
                <TableCell className="font-medium">{dr.title}{dr.project && <span className="block text-xs text-muted-foreground">{dr.project}</span>}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{dr.discipline}</TableCell>
                <TableCell><Badge variant="secondary" className="gap-1"><History className="h-3 w-3" />v{dr.revision}</Badge></TableCell>
                <TableCell><Badge variant={dr.status === 'APPROVED' || dr.status === 'ISSUED_FOR_CONSTRUCTION' ? 'success' : dr.status === 'FOR_REVIEW' ? 'warning' : 'secondary'}>{titleCase(dr.status)}</Badge></TableCell>
                <TableCell>{dr.fileId && <Button asChild variant="ghost" size="icon"><a href={`/api/files/${dr.fileId}`} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /></a></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></Card>
      </TabsContent>

      <TabsContent value="rfis">
        <Card><Table>
          <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Subject</TableHead><TableHead>Assignee</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rfis.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No RFIs yet.</TableCell></TableRow>}
            {rfis.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.number}</TableCell>
                <TableCell><p className="font-medium">{r.subject}</p><p className="max-w-md truncate text-xs text-muted-foreground">{r.response ? `A: ${r.response}` : r.question}</p></TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.assignedTo ?? r.consultant ?? '—'}</TableCell>
                <TableCell className="text-sm">{formatDate(r.dueDate)}</TableCell>
                <TableCell><Badge variant={r.status === 'CLOSED' ? 'secondary' : r.status === 'ANSWERED' ? 'success' : 'warning'}>{titleCase(r.status)}</Badge></TableCell>
                <TableCell>{r.status === 'OPEN' && <Button variant="ghost" size="sm" onClick={() => answer(r)}><MessageSquareReply className="h-4 w-4" /> Answer</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></Card>
      </TabsContent>

      <TabsContent value="issues">
        <Card><Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Severity</TableHead><TableHead>Assignee</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {issues.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No issues logged.</TableCell></TableRow>}
            {issues.map((i) => (
              <TableRow key={i.id}>
                <TableCell><p className="font-medium">{i.title}</p>{i.project && <p className="text-xs text-muted-foreground">{i.project}</p>}</TableCell>
                <TableCell><Badge variant={sevVariant(i.severity) as never}>{titleCase(i.severity)}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{i.assignedTo ?? '—'}</TableCell>
                <TableCell><Badge variant={i.status === 'RESOLVED' || i.status === 'CLOSED' ? 'success' : i.status === 'OPEN' ? 'secondary' : 'default'}>{titleCase(i.status)}</Badge></TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="sm">⋯</Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">{ISTATUS.map((s) => <DropdownMenuItem key={s} onClick={() => setIssue(i.id, s)}><Check className="h-4 w-4" /> {titleCase(s)}</DropdownMenuItem>)}</DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></Card>
      </TabsContent>

      <TabsContent value="consultants">
        <Card><Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Firm</TableHead><TableHead>Discipline</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
          <TableBody>
            {consultants.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No consultants yet.</TableCell></TableRow>}
            {consultants.map((c) => (<TableRow key={c.id}><TableCell className="font-medium">{c.name}</TableCell><TableCell className="text-sm">{c.firm ?? '—'}</TableCell><TableCell className="text-sm text-muted-foreground">{c.discipline ?? '—'}</TableCell><TableCell className="text-sm text-muted-foreground">{c.email ?? '—'}</TableCell></TableRow>))}
          </TableBody>
        </Table></Card>
      </TabsContent>

      {/* Drawing dialog */}
      <Dialog open={d === 'drawing'} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>New drawing</DialogTitle></DialogHeader>
          <form onSubmit={submitDrawing} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="number">Number</Label><Input id="number" name="number" required placeholder="AR-101" /></div>
              <div className="space-y-2"><Label htmlFor="discipline">Discipline</Label><Input id="discipline" name="discipline" defaultValue="Architecture" /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="title">Title</Label><Input id="title" name="title" required /></div>
            <div className="space-y-2"><Label htmlFor="projectId">Project</Label><select id="projectId" name="projectId" className={selectCls} defaultValue=""><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="file">Drawing file (optional)</Label><Input id="file" name="file" type="file" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Create</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* RFI dialog */}
      <Dialog open={d === 'rfi'} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>New RFI</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); run(() => createRFI({ subject: fd.get('subject'), question: fd.get('question'), projectId: fd.get('projectId') || null, assignedToId: fd.get('assignedToId') || null, consultantId: fd.get('consultantId') || null, dueDate: fd.get('dueDate') || null }), 'RFI raised'); }} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="subject">Subject</Label><Input id="subject" name="subject" required /></div>
            <div className="space-y-2"><Label htmlFor="question">Question</Label><Textarea id="question" name="question" required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="rassignee">Assign to</Label><select id="rassignee" name="assignedToId" className={selectCls} defaultValue=""><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="consultantId">Consultant</Label><select id="consultantId" name="consultantId" className={selectCls} defaultValue=""><option value="">—</option>{consultants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="rproject">Project</Label><select id="rproject" name="projectId" className={selectCls} defaultValue=""><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="rdue">Due</Label><Input id="rdue" name="dueDate" type="date" /></div>
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Raise RFI</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Issue dialog */}
      <Dialog open={d === 'issue'} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Log issue</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); run(() => createIssue({ title: fd.get('title'), description: fd.get('description'), severity: fd.get('severity'), projectId: fd.get('projectId') || null, assignedToId: fd.get('assignedToId') || null }), 'Issue logged'); }} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="ititle">Title</Label><Input id="ititle" name="title" required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="severity">Severity</Label><select id="severity" name="severity" className={selectCls} defaultValue="MEDIUM">{['LOW','MEDIUM','HIGH','CRITICAL'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="iassignee">Assign to</Label><select id="iassignee" name="assignedToId" className={selectCls} defaultValue=""><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="iproject">Project</Label><select id="iproject" name="projectId" className={selectCls} defaultValue=""><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            </div>
            <div className="space-y-2"><Label htmlFor="idesc">Description</Label><Textarea id="idesc" name="description" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Log issue</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Consultant dialog */}
      <Dialog open={d === 'consultant'} onOpenChange={(o) => !o && close()}>
        <DialogContent><DialogHeader><DialogTitle>New consultant</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); run(() => createConsultant({ name: fd.get('name'), firm: fd.get('firm'), discipline: fd.get('discipline'), email: fd.get('email') }), 'Consultant added'); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="cname">Name</Label><Input id="cname" name="name" required /></div>
              <div className="space-y-2"><Label htmlFor="cfirm">Firm</Label><Input id="cfirm" name="firm" /></div>
              <div className="space-y-2"><Label htmlFor="cdiscipline">Discipline</Label><Input id="cdiscipline" name="discipline" placeholder="Structural / MEP…" /></div>
              <div className="space-y-2"><Label htmlFor="cemail">Email</Label><Input id="cemail" name="email" type="email" /></div>
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Add</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

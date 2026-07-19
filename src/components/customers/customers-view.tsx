'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, Link2, MessageCircle, Trash2, FileText, RefreshCw } from 'lucide-react';
import { createCustomer, regenPortalToken, setCustomerActive, postConstructionUpdate, deleteConstructionUpdate, addCustomerDocument, setSnagStatus, assignSnag } from '@/server/actions/customers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Cust { id: string; name: string; email: string | null; phone: string | null; projectId: string | null; projectName: string | null; isActive: boolean; portalToken: string }
interface Upd { id: string; projectId: string; projectName: string; title: string; milestone: string | null; body: string | null; imageUrl: string | null; createdAt: string }
interface Ticket { id: string; customerId: string; customerName: string; title: string; description: string | null; category: string | null; priority: string; status: string; assignedToId: string | null; createdAt: string }
interface Doc { id: string; customerId: string; title: string; category: string | null; url: string }
interface Opt { id: string; name: string }
const sel9 = 'h-9 rounded-md border border-input bg-background px-3 text-sm';

export function CustomersView({ customers, updates, tickets, docs, projects, bookings, users, canManage }: {
  customers: Cust[]; updates: Upd[]; tickets: Ticket[]; docs: Doc[]; projects: Opt[]; bookings: Opt[]; users: Opt[]; canManage: boolean;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [sel, setSel] = React.useState<Cust | null>(null);
  const [pending, start] = React.useTransition();
  const act = (fn: () => Promise<{ ok: true } | { error: string } | { ok: true; token?: string }>, ok: string) =>
    start(async () => { const r = await fn(); if ('error' in r) return toast.error(r.error); toast.success(ok); router.refresh(); });

  const submitAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    start(async () => { const r = await createCustomer(Object.fromEntries(fd)); if ('error' in r) return toast.error(r.error); toast.success('Buyer onboarded'); setAddOpen(false); router.refresh(); });
  };
  const submitUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    start(async () => { const r = await postConstructionUpdate(Object.fromEntries(fd)); if ('error' in r) return toast.error(r.error); toast.success('Update posted'); (e.target as HTMLFormElement).reset(); router.refresh(); });
  };
  const submitDoc = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!sel) return; const fd = new FormData(e.currentTarget);
    start(async () => { const r = await addCustomerDocument({ customerId: sel.id, title: fd.get('title'), category: fd.get('category') || undefined, url: fd.get('url') }); if ('error' in r) return toast.error(r.error); toast.success('Document added'); (e.target as HTMLFormElement).reset(); router.refresh(); });
  };
  const portalLink = (token: string) => (typeof window !== 'undefined' ? `${window.location.origin}/portal/${token}` : `/portal/${token}`);
  const copyLink = (token: string) => { navigator.clipboard?.writeText(portalLink(token)); toast.success('Portal link copied'); };

  const selDocs = sel ? docs.filter((d) => d.customerId === sel.id) : [];

  return (
    <Tabs defaultValue="buyers">
      <TabsList className="mb-4"><TabsTrigger value="buyers">Buyers</TabsTrigger><TabsTrigger value="updates">Construction Updates</TabsTrigger><TabsTrigger value="snagging">Snagging {tickets.filter((t) => t.status !== 'RESOLVED').length ? `(${tickets.filter((t) => t.status !== 'RESOLVED').length})` : ''}</TabsTrigger></TabsList>

      <TabsContent value="buyers">
        {canManage && <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Onboard buyer</Button></div>}
        <Card><Table>
          <TableHeader><TableRow><TableHead>Buyer</TableHead><TableHead>Project</TableHead><TableHead>Portal</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {customers.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No buyers yet.</TableCell></TableRow>}
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.phone ?? c.email ?? '—'}</p></TableCell>
                <TableCell className="text-sm">{c.projectName ?? '—'}</TableCell>
                <TableCell><Badge variant={c.isActive ? 'success' : 'secondary'}>{c.isActive ? 'Active' : 'Disabled'}</Badge></TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => copyLink(c.portalToken)} title="Copy portal link"><Link2 className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => setSel(c)}>Manage</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></Card>
      </TabsContent>

      <TabsContent value="updates">
        {canManage && (
          <Card className="mb-4 p-4">
            <form onSubmit={submitUpdate} className="grid grid-cols-2 gap-3">
              <select name="projectId" required defaultValue="" className={`${sel9} col-span-2`}><option value="" disabled>Select project…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <Input name="title" placeholder="Title e.g. Plinth completed" required />
              <Input name="milestone" placeholder="Milestone (optional)" />
              <Input name="imageUrl" placeholder="Image URL (optional)" className="col-span-2" />
              <Input name="body" placeholder="Details for buyers…" className="col-span-2" />
              <div className="col-span-2 flex justify-end"><Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Post update</Button></div>
            </form>
          </Card>
        )}
        <div className="space-y-3">
          {updates.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No construction updates yet.</p>}
          {updates.map((u) => (
            <Card key={u.id} className="p-4">
              <div className="flex items-start justify-between">
                <div><p className="text-sm font-semibold">{u.title} {u.milestone && <Badge variant="secondary" className="ml-1">{u.milestone}</Badge>}</p><p className="text-xs text-muted-foreground">{u.projectName} · {new Date(u.createdAt).toLocaleDateString('en-IN')}</p>{u.body && <p className="mt-1 text-sm text-foreground/80">{u.body}</p>}</div>
                {canManage && <Button size="icon" variant="ghost" onClick={() => act(() => deleteConstructionUpdate(u.id), 'Deleted')}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="snagging">
        <Card><Table>
          <TableHeader><TableRow><TableHead>Issue</TableHead><TableHead>Buyer</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {tickets.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No snag tickets.</TableCell></TableRow>}
            {tickets.map((t) => (
              <TableRow key={t.id}>
                <TableCell><p className="font-medium">{t.title}</p>{t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}</TableCell>
                <TableCell className="text-sm">{t.customerName}</TableCell>
                <TableCell><Badge variant={t.priority === 'URGENT' || t.priority === 'HIGH' ? 'destructive' : 'secondary'}>{t.priority}</Badge></TableCell>
                <TableCell><Badge variant={t.status === 'RESOLVED' ? 'success' : t.status === 'IN_PROGRESS' ? 'warning' : 'secondary'}>{t.status.replace('_', ' ')}</Badge></TableCell>
                <TableCell className="text-right">{canManage && (
                  <span className="flex justify-end gap-1">
                    {t.status !== 'IN_PROGRESS' && t.status !== 'RESOLVED' && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => act(() => setSnagStatus(t.id, 'IN_PROGRESS'), 'In progress')}>Start</Button>}
                    {t.status !== 'RESOLVED' && <Button size="sm" variant="ghost" className="h-7 text-xs text-success" onClick={() => act(() => setSnagStatus(t.id, 'RESOLVED'), 'Resolved')}>Resolve</Button>}
                  </span>
                )}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></Card>
      </TabsContent>

      {/* Add buyer */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Onboard buyer</DialogTitle></DialogHeader>
          <form onSubmit={submitAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label htmlFor="name">Name *</Label><Input id="name" name="name" required /></div>
              <div className="space-y-1"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" /></div>
              <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" /></div>
              <div className="space-y-1"><Label htmlFor="projectId">Project</Label><select id="projectId" name="projectId" defaultValue="" className={`${sel9} w-full`}><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            </div>
            <div className="space-y-1"><Label htmlFor="bookingId">Link booking (optional)</Label><select id="bookingId" name="bookingId" defaultValue="" className={`${sel9} w-full`}><option value="">—</option>{bookings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Onboard</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage buyer */}
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          {sel && (
            <>
              <DialogHeader><DialogTitle>{sel.name}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="rounded-md border bg-secondary/30 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Buyer portal link (share via WhatsApp/email)</p>
                  <p className="break-all font-mono text-xs">{portalLink(sel.portalToken)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => copyLink(sel.portalToken)}><Link2 className="h-4 w-4" /> Copy</Button>
                    {sel.phone && <Button asChild size="sm" variant="outline" className="border-emerald-500/40 text-emerald-700"><a target="_blank" rel="noreferrer" href={`https://wa.me/${(sel.phone || '').replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(`Hello ${sel.name}, here is your Ameya Heights buyer portal: ${portalLink(sel.portalToken)}`)}`}><MessageCircle className="h-4 w-4" /> WhatsApp</a></Button>}
                    {canManage && <Button size="sm" variant="ghost" onClick={() => act(() => regenPortalToken(sel.id), 'New link generated')}><RefreshCw className="h-4 w-4" /> New link</Button>}
                    {canManage && <Button size="sm" variant="ghost" onClick={() => act(() => setCustomerActive(sel.id, !sel.isActive), 'Updated')}>{sel.isActive ? 'Disable' : 'Enable'}</Button>}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" /> Document vault</p>
                  {selDocs.length === 0 && <p className="text-xs text-muted-foreground">No documents shared yet.</p>}
                  {selDocs.map((d) => <div key={d.id} className="flex items-center justify-between border-b py-1 text-sm last:border-0"><span>{d.title} {d.category && <span className="text-xs text-muted-foreground">· {d.category}</span>}</span><a href={d.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">open</a></div>)}
                  {canManage && (
                    <form onSubmit={submitDoc} className="mt-3 grid grid-cols-3 gap-2">
                      <Input name="title" placeholder="Title e.g. Allotment Letter" required className="col-span-2" />
                      <Input name="category" placeholder="Category" />
                      <Input name="url" placeholder="File link or /api/files/… URL" required className="col-span-2" />
                      <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Add</Button>
                    </form>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

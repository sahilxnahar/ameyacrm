'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, Image as ImageIcon, MessageCircle, Linkedin, Instagram, Facebook, Twitter, Youtube, Link2, Trash2, ExternalLink, CheckCheck } from 'lucide-react';
import { createCampaign, createSocialPost, toggleSocialConnection, markActivityRead, deleteSocialActivity } from '@/server/actions/marketing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils/format';

const selectCls = 'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm';
const CHANNELS = ['META', 'GOOGLE', 'LINKEDIN', 'YOUTUBE', 'WHATSAPP', 'EMAIL', 'OFFLINE', 'OTHER'];
interface Opt { id: string; name: string }
interface Campaign { id: string; name: string; channel: string; status: string; budget: number | null; spend: number; leads: number; owner: string | null; project: string | null }
interface Post { id: string; title: string; channel: string; status: string; scheduledAt: string | null; author: string | null }
interface SocialAct { id: string; channel: string; kind: string; name: string | null; handle: string | null; message: string | null; url: string | null; leadId: string | null; isRead: boolean; createdAt: string }
interface Conn { channel: string; isConnected: boolean }
const SOCIAL = [
  { key: 'WHATSAPP', label: 'WhatsApp', Icon: MessageCircle, color: 'text-emerald-600' },
  { key: 'LINKEDIN', label: 'LinkedIn', Icon: Linkedin, color: 'text-blue-700' },
  { key: 'INSTAGRAM', label: 'Instagram', Icon: Instagram, color: 'text-pink-600' },
  { key: 'FACEBOOK', label: 'Facebook', Icon: Facebook, color: 'text-blue-600' },
  { key: 'TWITTER', label: 'Twitter / X', Icon: Twitter, color: 'text-sky-500' },
  { key: 'YOUTUBE', label: 'YouTube', Icon: Youtube, color: 'text-red-600' },
] as const;
function cVariant(s: string) { return s === 'ACTIVE' ? 'success' : s === 'PAUSED' ? 'warning' : s === 'CANCELLED' ? 'destructive' : s === 'DRAFT' ? 'secondary' : 'default'; }

export function MarketingView({ campaigns, posts, projects, socialActivities, connections, canManage }: { campaigns: Campaign[]; posts: Post[]; projects: Opt[]; socialActivities: SocialAct[]; connections: Conn[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [campOpen, setCampOpen] = React.useState(false);
  const [postOpen, setPostOpen] = React.useState(false);
  const isConn = (ch: string) => connections.find((c) => c.channel === ch)?.isConnected ?? false;
  const toggleConn = (ch: string, cur: boolean) => start(async () => { const r = await toggleSocialConnection(ch, !cur); if ('error' in r) return toast.error(r.error); toast.success(!cur ? 'Marked connected' : 'Disconnected'); router.refresh(); });
  const copyHook = (ch: string) => { const base = typeof window !== 'undefined' ? window.location.origin : ''; navigator.clipboard?.writeText(`${base}/api/ingest/social?key=YOUR_INGEST_SECRET&channel=${ch.toLowerCase()}`); toast.success('Webhook URL copied — swap in your INGEST_SECRET'); };
  const readAct = (id: string) => start(async () => { await markActivityRead(id, true); router.refresh(); });
  const delAct = (id: string) => start(async () => { const r = await deleteSocialActivity(id); if ('error' in r) return toast.error(r.error); toast.success('Removed'); router.refresh(); });

  const submitCamp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createCampaign({ name: fd.get('name'), channel: fd.get('channel'), objective: fd.get('objective'), budget: fd.get('budget') || undefined, startDate: fd.get('startDate') || null, endDate: fd.get('endDate') || null, projectId: fd.get('projectId') || null });
      if ('error' in r) return toast.error(r.error);
      toast.success('Campaign created'); setCampOpen(false); router.refresh();
    });
  };
  const submitPost = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createSocialPost({ title: fd.get('title'), content: fd.get('content'), channel: fd.get('channel'), scheduledAt: fd.get('scheduledAt') || null });
      if ('error' in r) return toast.error(r.error);
      toast.success('Post planned'); setPostOpen(false); router.refresh();
    });
  };

  return (
    <Tabs defaultValue="campaigns">
      <div className="mb-4 flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="social">Social Calendar</TabsTrigger>
          <TabsTrigger value="assets">Asset Library</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="inbox">Social Inbox{socialActivities.filter((a) => !a.isRead).length ? ` (${socialActivities.filter((a) => !a.isRead).length})` : ''}</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="channels">
        <p className="mb-3 text-sm text-muted-foreground">Point a free Zapier/Make automation (or the platform&apos;s native webhook) at the URL below. New leads, inquiries, DMs, comments, subscribers and followers then flow into your Social Inbox — and lead/inquiry events auto-create a CRM lead.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SOCIAL.map(({ key, label, Icon, color }) => {
            const on = isConn(key);
            return (
              <Card key={key} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Icon className={`h-6 w-6 ${color}`} /><span className="font-medium">{label}</span></div>
                  <Badge variant={on ? 'success' : 'secondary'}>{on ? 'Connected' : 'Not connected'}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyHook(key)}><Link2 className="h-4 w-4" /> Copy webhook</Button>
                  {canManage && <Button size="sm" variant={on ? 'ghost' : 'default'} disabled={pending} onClick={() => toggleConn(key, on)}>{on ? 'Disconnect' : 'Mark connected'}</Button>}
                </div>
              </Card>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="inbox">
        <Card className="divide-y">
          {socialActivities.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No social activity yet. Connect a channel to start capturing leads and inquiries.</p>}
          {socialActivities.map((a) => (
            <div key={a.id} className={`flex items-start gap-3 p-3 ${a.isRead ? '' : 'bg-primary/5'}`}>
              <Badge variant="secondary" className="mt-0.5 shrink-0">{titleCase(a.channel)}</Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm"><span className="font-medium">{a.name ?? a.handle ?? 'Unknown'}</span> <span className="text-xs text-muted-foreground">· {a.kind}</span></p>
                {a.message && <p className="text-sm text-foreground/80">{a.message}</p>}
                <p className="text-xs text-muted-foreground">{formatDate(a.createdAt, 'dd MMM, HH:mm')}{a.handle ? ` · ${a.handle}` : ''}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {a.leadId && <Button asChild size="sm" variant="ghost" className="h-7 text-xs"><a href={`/sales/${a.leadId}`}>Lead</a></Button>}
                {a.url && <Button asChild size="icon" variant="ghost" className="h-7 w-7"><a href={a.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>}
                {!a.isRead && <Button size="icon" variant="ghost" className="h-7 w-7" disabled={pending} onClick={() => readAct(a.id)} title="Mark read"><CheckCheck className="h-4 w-4" /></Button>}
                {canManage && <Button size="icon" variant="ghost" className="h-7 w-7" disabled={pending} onClick={() => delAct(a.id)}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
          ))}
        </Card>
      </TabsContent>

      <TabsContent value="campaigns">
        <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => setCampOpen(true)}><Plus className="h-4 w-4" /> New campaign</Button></div>
        <Card><Table>
          <TableHeader><TableRow><TableHead>Campaign</TableHead><TableHead>Channel</TableHead><TableHead>Status</TableHead><TableHead>Leads</TableHead><TableHead className="text-right">Budget</TableHead><TableHead className="text-right">Spend</TableHead></TableRow></TableHeader>
          <TableBody>
            {campaigns.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No campaigns yet.</TableCell></TableRow>}
            {campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.owner ?? '—'}{c.project ? ` · ${c.project}` : ''}</p></TableCell>
                <TableCell><Badge variant="outline">{titleCase(c.channel)}</Badge></TableCell>
                <TableCell><Badge variant={cVariant(c.status) as never}>{titleCase(c.status)}</Badge></TableCell>
                <TableCell className="tabular-nums">{c.leads}</TableCell>
                <TableCell className="text-right tabular-nums">{c.budget != null ? formatCurrency(c.budget) : '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(c.spend)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></Card>
      </TabsContent>

      <TabsContent value="social">
        <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => setPostOpen(true)}><Plus className="h-4 w-4" /> New post</Button></div>
        <Card><Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Channel</TableHead><TableHead>Status</TableHead><TableHead>Scheduled</TableHead><TableHead>Author</TableHead></TableRow></TableHeader>
          <TableBody>
            {posts.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No posts planned.</TableCell></TableRow>}
            {posts.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.title}</TableCell>
                <TableCell><Badge variant="outline">{titleCase(p.channel)}</Badge></TableCell>
                <TableCell><Badge variant={p.status === 'PUBLISHED' ? 'success' : p.status === 'SCHEDULED' ? 'default' : 'secondary'}>{titleCase(p.status)}</Badge></TableCell>
                <TableCell className="text-sm">{formatDate(p.scheduledAt)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.author ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></Card>
      </TabsContent>

      <TabsContent value="assets">
        <Card className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
          <p className="text-sm">Creatives and brochures live in the <a href="/documents" className="text-primary hover:underline">Document Library</a> and can be linked to campaigns as marketing assets.</p>
        </Card>
      </TabsContent>

      <Dialog open={campOpen} onOpenChange={setCampOpen}>
        <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>New campaign</DialogTitle></DialogHeader>
          <form onSubmit={submitCamp} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="channel">Channel</Label><select id="channel" name="channel" className={selectCls} defaultValue="META">{CHANNELS.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="budget">Budget (₹)</Label><Input id="budget" name="budget" type="number" /></div>
              <div className="space-y-2"><Label htmlFor="startDate">Start</Label><Input id="startDate" name="startDate" type="date" /></div>
              <div className="space-y-2"><Label htmlFor="endDate">End</Label><Input id="endDate" name="endDate" type="date" /></div>
              <div className="space-y-2"><Label htmlFor="projectId">Project</Label><select id="projectId" name="projectId" className={selectCls} defaultValue=""><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            </div>
            <div className="space-y-2"><Label htmlFor="objective">Objective</Label><Textarea id="objective" name="objective" placeholder="e.g. Site visits for Tower A launch" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCampOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Create</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>New social post</DialogTitle></DialogHeader>
          <form onSubmit={submitPost} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="ptitle">Title</Label><Input id="ptitle" name="title" required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="pchannel">Channel</Label><select id="pchannel" name="channel" className={selectCls} defaultValue="META">{CHANNELS.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="scheduledAt">Schedule</Label><Input id="scheduledAt" name="scheduledAt" type="datetime-local" /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="content">Content</Label><Textarea id="content" name="content" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setPostOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Plan post</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

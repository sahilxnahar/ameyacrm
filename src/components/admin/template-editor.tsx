'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save, Plus } from 'lucide-react';
import { updateEmailTemplate, createEmailTemplate } from '@/server/actions/admin-config';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Tmpl { id: string; key: string; name: string; subject: string; body: string; isActive: boolean }

export function TemplateEditor({ templates }: { templates: Tmpl[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState(templates[0]?.id ?? '');
  const [pending, start] = React.useTransition();
  const [newOpen, setNewOpen] = React.useState(false);
  const current = templates.find((t) => t.id === selectedId);
  const [subject, setSubject] = React.useState(current?.subject ?? '');
  const [body, setBody] = React.useState(current?.body ?? '');

  React.useEffect(() => { const c = templates.find((t) => t.id === selectedId); setSubject(c?.subject ?? ''); setBody(c?.body ?? ''); }, [selectedId, templates]);

  const save = () => { if (!current) return; start(async () => {
    const r = await updateEmailTemplate({ id: current.id, name: current.name, subject, body, isActive: current.isActive });
    if ('error' in r) return toast.error(r.error);
    toast.success('Template saved'); router.refresh();
  }); };
  const submitNew = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createEmailTemplate({ key: fd.get('key'), name: fd.get('name'), subject: fd.get('subject'), body: fd.get('body') });
      if ('error' in r) return toast.error(r.error);
      toast.success('Template created'); setNewOpen(false); router.refresh();
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <div className="space-y-2">
        <Button size="sm" variant="outline" className="w-full" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New template</Button>
        {templates.map((t) => (
          <button key={t.id} onClick={() => setSelectedId(t.id)} className={`w-full rounded-md border p-2 text-left text-sm ${selectedId === t.id ? 'border-primary bg-primary/10' : 'hover:bg-secondary'}`}>
            <div className="font-medium">{t.name}</div>
            <div className="font-mono text-[10px] text-muted-foreground">{t.key}</div>
          </button>
        ))}
      </div>

      {current ? (
        <Card><CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2"><Badge variant="secondary">{current.key}</Badge>{!current.isActive && <Badge variant="outline">Inactive</Badge>}</div>
          <div className="space-y-2"><Label htmlFor="subject">Subject</Label><Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="body">Body</Label><Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[260px] font-mono text-sm" /></div>
          <p className="text-xs text-muted-foreground">Placeholders like <code>{'{{reference}}'}</code>, <code>{'{{project}}'}</code>, <code>{'{{items}}'}</code> are replaced when the email is generated.</p>
          <Button onClick={save} disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save template</Button>
        </CardContent></Card>
      ) : <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No templates yet — create one.</CardContent></Card>}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New email template</DialogTitle></DialogHeader>
          <form onSubmit={submitNew} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="nkey">Key</Label><Input id="nkey" name="key" required placeholder="welcome_email" /></div>
              <div className="space-y-2"><Label htmlFor="nname">Name</Label><Input id="nname" name="name" required /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="nsubject">Subject</Label><Input id="nsubject" name="subject" required /></div>
            <div className="space-y-2"><Label htmlFor="nbody">Body</Label><Textarea id="nbody" name="body" required className="min-h-[160px]" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Create</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Building2, Archive, RotateCcw, Pencil, X } from 'lucide-react';
import { createProject, updateProject, setProjectActive } from '@/server/actions/projects';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';

export interface ProjectRow {
  id: string;
  name: string;
  code: string;
  city: string;
  address: string | null;
  reraNumber: string | null;
  description: string | null;
  isActive: boolean;
  units: number;
  leads: number;
}

export function ProjectsView({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [addOpen, setAddOpen] = React.useState(projects.length === 0);
  const [editing, setEditing] = React.useState<string | null>(null);

  const add = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get('name') || '').trim();
    if (!name) { toast.error('Give the project a name.'); return; }
    start(async () => {
      const r = await createProject({
        name,
        code: String(f.get('code') || ''),
        city: String(f.get('city') || ''),
        address: String(f.get('address') || ''),
        reraNumber: String(f.get('reraNumber') || ''),
        description: String(f.get('description') || ''),
      });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`Project “${name}” created`);
      setAddOpen(false);
      router.refresh();
    });
  };

  const saveEdit = (id: string, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => {
      const r = await updateProject(id, {
        name: String(f.get('name') || ''),
        city: String(f.get('city') || ''),
        address: String(f.get('address') || ''),
        reraNumber: String(f.get('reraNumber') || ''),
        description: String(f.get('description') || ''),
      });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Saved');
      setEditing(null);
      router.refresh();
    });
  };

  const toggle = (id: string, isActive: boolean) => {
    start(async () => {
      const r = await setProjectActive(id, isActive);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(isActive ? 'Project re-activated' : 'Project archived');
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{projects.filter((p) => p.isActive).length} active · {projects.length} total</p>
        <Button size="sm" onClick={() => setAddOpen((v) => !v)}>
          {addOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {addOpen ? 'Close' : 'New project'}
        </Button>
      </div>

      {addOpen && (
        <Card className="p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Building2 className="h-4 w-4 text-[#A07D34]" /> Add a project</p>
          <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
            <Field label="Project name *"><Input name="name" required placeholder="e.g. Ameya 494" /></Field>
            <Field label="Short code (optional)"><Input name="code" placeholder="Auto-made from the name if left blank" /></Field>
            <Field label="City"><Input name="city" defaultValue="Bangalore" /></Field>
            <Field label="RERA number (optional)"><Input name="reraNumber" placeholder="PRM/KA/RERA/…" /></Field>
            <div className="sm:col-span-2"><Field label="Address (optional)"><Input name="address" placeholder="Site address" /></Field></div>
            <div className="sm:col-span-2"><Field label="Description (optional)"><Input name="description" placeholder="One line about this project" /></Field></div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Create project</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-3">
        {projects.map((p) => (
          <Card key={p.id} className="p-4">
            {editing === p.id ? (
              <form onSubmit={(e) => saveEdit(p.id, e)} className="grid gap-3 sm:grid-cols-2">
                <Field label="Project name"><Input name="name" defaultValue={p.name} /></Field>
                <Field label="City"><Input name="city" defaultValue={p.city} /></Field>
                <Field label="RERA number"><Input name="reraNumber" defaultValue={p.reraNumber ?? ''} /></Field>
                <Field label="Address"><Input name="address" defaultValue={p.address ?? ''} /></Field>
                <div className="sm:col-span-2"><Field label="Description"><Input name="description" defaultValue={p.description ?? ''} /></Field></div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{p.name}</p>
                    <Badge variant="secondary" className="font-mono text-[10px]">{p.code}</Badge>
                    {!p.isActive && <Badge variant="outline" className="text-[10px] text-muted-foreground">Archived</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.city}{p.address ? ` · ${p.address}` : ''}{p.reraNumber ? ` · RERA ${p.reraNumber}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{p.units} units · {p.leads} leads</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p.id)}><Pencil className="h-4 w-4" /> Edit</Button>
                  {p.isActive ? (
                    <Button size="sm" variant="ghost" onClick={() => toggle(p.id, false)} disabled={pending}><Archive className="h-4 w-4" /> Archive</Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => toggle(p.id, true)} disabled={pending}><RotateCcw className="h-4 w-4" /> Restore</Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

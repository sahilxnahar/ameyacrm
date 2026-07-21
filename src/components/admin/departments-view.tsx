'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Download, Users, EyeOff, Eye, ChevronRight } from 'lucide-react';
import { importDepartments, setDepartmentHead, setDepartmentActive } from '@/server/actions/departments';
import type { DeptSeed } from '@/config/departments';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const SELECT = 'h-8 rounded-md border border-input bg-background px-2 text-xs';

interface Dept { id: string; slug: string; name: string; description: string | null; color: string | null; parentId: string | null; headId: string | null; isActive: boolean; headcount: number }

export function DepartmentsView({
  catalogue, existingSlugs, departments, users,
}: {
  catalogue: DeptSeed[];
  existingSlugs: string[];
  departments: Dept[];
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());

  const have = new Set(existingSlugs);
  const divisions = departments.filter((d) => !d.parentId);
  const childrenOf = (id: string) => departments.filter((d) => d.parentId === id);

  const run = (fn: () => Promise<{ ok?: true; created?: number; skipped?: number } | { error: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if ('error' in r && r.error) { toast.error(r.error); return; }
      toast.success('created' in r && r.created !== undefined ? `${ok} — ${r.created} added, ${r.skipped ?? 0} already there` : ok);
      router.refresh();
      setOpen(false);
      setPicked(new Set());
    });

  const toggle = (slug: string, on: boolean) =>
    setPicked((prev) => { const n = new Set(prev); on ? n.add(slug) : n.delete(slug); return n; });

  const toggleDivision = (d: DeptSeed, on: boolean) =>
    setPicked((prev) => {
      const n = new Set(prev);
      [d.slug, ...d.children.map((c) => c.slug)].forEach((s) => (on ? n.add(s) : n.delete(s)));
      return n;
    });

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium">Standard real-estate structure</p>
          <p className="text-sm text-muted-foreground">
            {catalogue.length} divisions and {catalogue.reduce((n, d) => n + d.children.length, 0)} teams used across Indian developers. Pick only what you need — you can come back and add more later.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Download className="h-4 w-4" /> Add from catalogue</Button>
      </Card>

      {divisions.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No departments yet. Use &ldquo;Add from catalogue&rdquo; to start.</Card>
      ) : (
        <div className="space-y-3">
          {divisions.map((d) => (
            <Card key={d.id} className={d.isActive ? '' : 'opacity-55'}>
              <Row dept={d} users={users} pending={pending} run={run} isDivision />
              {childrenOf(d.id).map((c) => (
                <div key={c.id} className={'border-t pl-6 ' + (c.isActive ? '' : 'opacity-55')}>
                  <Row dept={c} users={users} pending={pending} run={run} />
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Add departments</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ticking a team automatically brings its division with it. Anything you already have is greyed out and will not be touched.
          </p>
          <div className="space-y-4">
            {catalogue.map((div) => {
              const allIn = [div.slug, ...div.children.map((c) => c.slug)].every((s) => have.has(s));
              return (
                <div key={div.slug} className="rounded-md border p-3">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1" disabled={allIn}
                      checked={picked.has(div.slug) || allIn}
                      onChange={(e) => toggleDivision(div, e.target.checked)} />
                    <span>
                      <span className="text-sm font-medium" style={{ color: div.color }}>{div.name}</span>
                      <span className="block text-xs text-muted-foreground">{div.description}</span>
                    </span>
                  </label>
                  <div className="mt-2 grid gap-1 pl-6 sm:grid-cols-2">
                    {div.children.map((c) => (
                      <label key={c.slug} className="flex items-start gap-2" title={c.description}>
                        <input type="checkbox" className="mt-1" disabled={have.has(c.slug)}
                          checked={picked.has(c.slug) || have.has(c.slug)}
                          onChange={(e) => toggle(c.slug, e.target.checked)} />
                        <span className="text-xs">
                          {c.name}
                          {have.has(c.slug) && <Badge variant="secondary" className="ml-1 text-[10px]">already added</Badge>}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={pending || picked.size === 0} onClick={() => run(() => importDepartments([...picked]), 'Departments added')}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Add {picked.size || ''} selected
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({
  dept, users, pending, run, isDivision,
}: {
  dept: Dept;
  users: { id: string; name: string }[];
  pending: boolean;
  run: (fn: () => Promise<{ ok?: true } | { error: string }>, ok: string) => void;
  isDivision?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 items-center gap-2">
        {!isDivision && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dept.color ?? '#A07D34' }} />
        <span className="min-w-0">
          <span className={isDivision ? 'text-sm font-semibold' : 'text-sm'}>{dept.name}</span>
          {dept.description && <span className="block truncate text-xs text-muted-foreground">{dept.description}</span>}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" /> {dept.headcount}</Badge>
        <select
          className={SELECT}
          defaultValue={dept.headId ?? ''}
          disabled={pending}
          title="The person who runs this department"
          onChange={(e) => run(() => setDepartmentHead(dept.id, e.target.value || null), 'Head updated')}
        >
          <option value="">No head assigned</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <Button
          size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs font-normal" disabled={pending}
          title={dept.isActive ? 'Hide this department without deleting it' : 'Bring this department back'}
          onClick={() => run(() => setDepartmentActive(dept.id, !dept.isActive), dept.isActive ? 'Hidden' : 'Restored')}
        >
          {dept.isActive ? <><EyeOff className="h-3.5 w-3.5" /> Hide</> : <><Eye className="h-3.5 w-3.5" /> Restore</>}
        </Button>
      </div>
    </div>
  );
}

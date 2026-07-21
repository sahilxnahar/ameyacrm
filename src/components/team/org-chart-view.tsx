'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Network, Building2, AlertTriangle, ChevronRight, ChevronDown, Crown, User as UserIcon } from 'lucide-react';
import { setUserManager, setUserDepartment } from '@/server/actions/admin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';

const SELECT = 'h-8 rounded-md border border-input bg-background px-2 text-xs';

interface Person {
  id: string; name: string; email: string; role: string; designation: string | null;
  status: string; managerId: string | null; departmentId: string | null;
  departmentName: string | null; isDeptHead: boolean; reportCount: number;
}
interface Division { id: string; name: string; color: string | null; headId: string | null; parentId: string | null; memberIds: string[] }

export function OrgChartView({
  people, departments, gaps, canEdit, meId,
}: {
  people: Person[];
  departments: Division[];
  gaps: { noManager: number; noDepartment: number; deptNoHead: number };
  canEdit: boolean;
  meId: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [mode, setMode] = React.useState<'reporting' | 'department'>('reporting');
  const [q, setQ] = React.useState('');

  const byId = React.useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const childrenOf = React.useMemo(() => {
    const m = new Map<string | null, Person[]>();
    people.forEach((p) => {
      const k = p.managerId && byId.has(p.managerId) ? p.managerId : null;
      m.set(k, [...(m.get(k) ?? []), p]);
    });
    return m;
  }, [people, byId]);

  const run = (fn: () => Promise<{ ok?: true } | { error: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if ('error' in r && r.error) { toast.error(r.error); return; }
      toast.success(ok);
      router.refresh();
    });

  const matches = (p: Person) =>
    !q || [p.name, p.email, p.designation, p.departmentName].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase());

  const card = (p: Person, depth: number) => (
    <PersonRow
      key={p.id} p={p} depth={depth} canEdit={canEdit} pending={pending} isMe={p.id === meId}
      people={people} departments={departments} run={run}
    />
  );

  const renderTree = (managerId: string | null, depth: number): React.ReactNode =>
    (childrenOf.get(managerId) ?? [])
      .slice()
      .sort((a, b) => b.reportCount - a.reportCount || a.name.localeCompare(b.name))
      .map((p) => (
        <Branch key={p.id} hasChildren={(childrenOf.get(p.id) ?? []).length > 0} depth={depth}>
          {card(p, depth)}
          {renderTree(p.id, depth + 1)}
        </Branch>
      ));

  const divisions = departments.filter((d) => !d.parentId);
  const teamsOf = (id: string) => departments.filter((d) => d.parentId === id);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Gap label="People with no manager" value={gaps.noManager} hint="They sit at the top of the chart. Fine for you; a gap for everyone else." />
        <Gap label="People with no department" value={gaps.noDepartment} hint="They will not appear under any team." />
        <Gap label="Departments with no head" value={gaps.deptNoHead} hint="Set one on Admin → Departments." />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={mode === 'reporting' ? 'default' : 'outline'} onClick={() => setMode('reporting')}>
          <Network className="h-4 w-4" /> By reporting line
        </Button>
        <Button size="sm" variant={mode === 'department' ? 'default' : 'outline'} onClick={() => setMode('department')}>
          <Building2 className="h-4 w-4" /> By department
        </Button>
        <Input className="h-8 max-w-xs" placeholder="Find a person…" value={q} onChange={(e) => setQ(e.target.value)} />
        {!canEdit && <span className="text-xs text-muted-foreground">View only — an administrator can change reporting lines.</span>}
      </div>

      {mode === 'reporting' ? (
        <Card className="p-3">
          {q
            ? <div className="space-y-1">{people.filter(matches).map((p) => card(p, 0))}</div>
            : <div className="space-y-1">{renderTree(null, 0)}</div>}
        </Card>
      ) : (
        <div className="space-y-3">
          {divisions.map((d) => {
            const teams = teamsOf(d.id);
            const direct = people.filter((p) => p.departmentId === d.id && matches(p));
            const anyTeamMatch = teams.some((t) => people.some((p) => p.departmentId === t.id && matches(p)));
            if (q && !direct.length && !anyTeamMatch) return null;
            return (
              <Card key={d.id}>
                <div className="flex items-center gap-2 border-b p-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color ?? '#A07D34' }} />
                  <span className="text-sm font-semibold">{d.name}</span>
                  {d.headId && byId.get(d.headId) && (
                    <Badge variant="secondary" className="gap-1"><Crown className="h-3 w-3" /> {byId.get(d.headId)!.name}</Badge>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {direct.length + teams.reduce((n, t) => n + t.memberIds.length, 0)} people
                  </span>
                </div>
                <div className="space-y-1 p-2">{direct.map((p) => card(p, 0))}</div>
                {teams.map((t) => {
                  const members = people.filter((p) => p.departmentId === t.id && matches(p));
                  if (q && !members.length) return null;
                  return (
                    <div key={t.id} className="border-t">
                      <div className="flex items-center gap-2 px-3 pt-2 text-xs font-medium text-muted-foreground">
                        <ChevronRight className="h-3 w-3" /> {t.name}
                        {t.headId && byId.get(t.headId) && <Badge variant="outline" className="text-[10px]">{byId.get(t.headId)!.name}</Badge>}
                      </div>
                      <div className="space-y-1 p-2">
                        {members.length ? members.map((p) => card(p, 0))
                          : <p className="px-2 pb-1 text-xs text-muted-foreground">Nobody assigned yet.</p>}
                      </div>
                    </div>
                  );
                })}
              </Card>
            );
          })}
          {people.some((p) => !p.departmentId) && (
            <Card>
              <div className="flex items-center gap-2 border-b p-3">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-sm font-semibold">Not in any department</span>
              </div>
              <div className="space-y-1 p-2">{people.filter((p) => !p.departmentId && matches(p)).map((p) => card(p, 0))}</div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Branch({ children, depth, hasChildren }: { children: React.ReactNode; depth: number; hasChildren: boolean }) {
  const [open, setOpen] = React.useState(depth < 2);
  const [head, ...rest] = React.Children.toArray(children);
  return (
    <div>
      <div className="flex items-start gap-1">
        {hasChildren ? (
          <button onClick={() => setOpen((v) => !v)} className="mt-2 shrink-0 text-muted-foreground" aria-label={open ? 'Collapse' : 'Expand'}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : <span className="w-4 shrink-0" />}
        <div className="min-w-0 flex-1">{head}</div>
      </div>
      {open && rest.length > 0 && <div className="ml-5 border-l pl-3">{rest}</div>}
    </div>
  );
}

function PersonRow({
  p, depth, canEdit, pending, isMe, people, departments, run,
}: {
  p: Person; depth: number; canEdit: boolean; pending: boolean; isMe: boolean;
  people: Person[]; departments: Division[];
  run: (fn: () => Promise<{ ok?: true } | { error: string }>, ok: string) => void;
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5', isMe && 'bg-primary/5')}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
          {p.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            {p.name}
            {p.isDeptHead && <Badge variant="secondary" className="gap-1 text-[10px]"><Crown className="h-3 w-3" /> Head</Badge>}
            {p.reportCount > 0 && <Badge variant="outline" className="gap-1 text-[10px]"><UserIcon className="h-3 w-3" /> {p.reportCount}</Badge>}
            {p.status !== 'ACTIVE' && <Badge variant="warning" className="text-[10px]">{p.status}</Badge>}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {[p.designation, p.role.replace(/_/g, ' ').toLowerCase(), p.departmentName].filter(Boolean).join(' · ')}
          </span>
        </span>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            className={SELECT} disabled={pending} defaultValue={p.managerId ?? ''}
            title="Who this person reports to"
            onChange={(e) => run(() => setUserManager(p.id, e.target.value || null), 'Reporting line updated')}
          >
            <option value="">Reports to: nobody</option>
            {people.filter((o) => o.id !== p.id).map((o) => <option key={o.id} value={o.id}>Reports to: {o.name}</option>)}
          </select>
          <select
            className={SELECT} disabled={pending} defaultValue={p.departmentId ?? ''}
            title="Which team this person sits in"
            onChange={(e) => run(() => setUserDepartment(p.id, e.target.value || null), 'Department updated')}
          >
            <option value="">No department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.parentId ? '— ' : ''}{d.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

function Gap({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card className="p-3">
      <p className="flex items-baseline gap-2">
        <span className={cn('font-display text-2xl font-semibold tabular', value > 0 ? 'text-warning' : 'text-success')}>{value}</span>
        <span className="text-sm">{label}</span>
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

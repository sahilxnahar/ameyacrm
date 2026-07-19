'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Loader2, Save, ShieldCheck } from 'lucide-react';
import type { RoleName } from '@prisma/client';
import { setRolePermissions } from '@/server/actions/admin-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { titleCase } from '@/lib/utils/format';

interface Perm { key: string; module: string; description: string }
interface RoleOpt { value: RoleName; label: string }

export function PermissionEditor({ permissions, roles, allowedByRole }: {
  permissions: Perm[]; roles: RoleOpt[]; allowedByRole: Record<string, string[]>;
}) {
  const [role, setRole] = React.useState<RoleName>(roles[0]?.value ?? 'EMPLOYEE');
  const [checked, setChecked] = React.useState<Set<string>>(new Set(allowedByRole[role] ?? []));
  const [pending, start] = React.useTransition();

  React.useEffect(() => { setChecked(new Set(allowedByRole[role] ?? [])); }, [role, allowedByRole]);

  const modules = React.useMemo(() => {
    const m = new Map<string, Perm[]>();
    permissions.forEach((p) => { const a = m.get(p.module) ?? []; a.push(p); m.set(p.module, a); });
    return [...m.entries()];
  }, [permissions]);

  const toggle = (key: string, on: boolean) => setChecked((prev) => { const n = new Set(prev); on ? n.add(key) : n.delete(key); return n; });
  const save = () => start(async () => {
    const r = await setRolePermissions(role, [...checked]);
    if ('error' in r) return toast.error(r.error);
    toast.success('Permissions saved');
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Editing role:</label>
        <select value={role} onChange={(e) => setRole(e.target.value as RoleName)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">{checked.size} of {permissions.length} enabled</span>
        <Button size="sm" className="ml-auto" onClick={save} disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {modules.map(([module, perms]) => (
          <Card key={module}>
            <CardHeader className="py-3"><CardTitle className="text-base">{titleCase(module)}</CardTitle></CardHeader>
            <CardContent className="space-y-2 pb-4">
              {perms.map((p) => (
                <label key={p.key} className="flex items-center justify-between gap-3 text-sm">
                  <span><span className="font-medium">{p.description}</span><span className="ml-2 font-mono text-[10px] text-muted-foreground">{p.key}</span></span>
                  <Switch checked={checked.has(p.key)} onCheckedChange={(v) => toggle(p.key, v)} />
                </label>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Changes apply immediately after saving. Per-user overrides still take precedence.</p>
    </div>
  );
}

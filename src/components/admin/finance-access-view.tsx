'use client';

import { useMemo, useState, useTransition } from 'react';
import { ShieldCheck, Crown, Search, Loader2, Info } from 'lucide-react';
import { setFinanceAccess } from '@/server/actions/finance-access';
import { ROLE_LABELS } from '@/lib/rbac/roles';

export interface FinancePerson {
  id: string; name: string; email: string; role: string; status: string;
  department: string | null; isSuper: boolean; canView: boolean; canRecord: boolean;
}

export function FinanceAccessView({ people }: { people: FinancePerson[] }) {
  const [rows, setRows] = useState(people);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  const withAccess = rows.filter((p) => p.canView);
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter((p) => p.name.toLowerCase().includes(n) || p.email.toLowerCase().includes(n) || (p.department ?? '').toLowerCase().includes(n));
  }, [rows, q]);

  const change = (p: FinancePerson, next: { canView: boolean; canRecord: boolean }) => {
    if (p.isSuper) return;
    const before = rows;
    setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, ...next } : r)));
    setBusy(p.id);
    start(async () => {
      const res = await setFinanceAccess({ userId: p.id, ...next });
      setBusy(null);
      if ('error' in res) { setRows(before); setMsg({ kind: 'err', text: res.error }); }
      else setMsg({ kind: 'ok', text: res.message });
    });
  };

  return (
    <div className="space-y-5">
      <div className="card-elevated flex flex-wrap items-start gap-3 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">{withAccess.length} {withAccess.length === 1 ? 'person' : 'people'}</strong> can
            see expenses and payments. For everybody else the Payments and Cash Book menus do not appear at all.
          </p>
          <p className="mt-1">Super Admins always have access and cannot be switched off here. Only a Super Admin can change this page.</p>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a name, email or department…"
          className="focus-ring w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm"
        />
      </div>

      {msg && (
        <p className={`rounded-md p-3 text-sm ${msg.kind === 'ok' ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'}`}>
          {msg.text}
        </p>
      )}

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Person</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="w-32 px-4 py-2.5 text-center font-medium">Can see</th>
              <th className="w-40 px-4 py-2.5 text-center font-medium">Can record</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((p) => (
              <tr key={p.id} className={p.canView ? 'bg-emerald-50/40 dark:bg-emerald-950/10' : undefined}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {p.isSuper && <Crown className="h-4 w-4 shrink-0 text-primary" />}
                    {!p.isSuper && p.canView && <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />}
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.email}{p.department ? ` · ${p.department}` : ''}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{ROLE_LABELS[p.role as keyof typeof ROLE_LABELS] ?? p.role}</td>
                <td className="px-4 py-3 text-center">
                  {p.isSuper ? (
                    <span className="text-xs text-muted-foreground">Always</span>
                  ) : (
                    <input
                      type="checkbox" checked={p.canView} disabled={busy === p.id}
                      onChange={(e) => change(p, { canView: e.target.checked, canRecord: e.target.checked ? p.canRecord : false })}
                      className="focus-ring h-4 w-4 accent-[hsl(var(--primary))]"
                      aria-label={`${p.name} can see expenses and payments`}
                    />
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {p.isSuper ? (
                    <span className="text-xs text-muted-foreground">Always</span>
                  ) : busy === p.id ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <input
                      type="checkbox" checked={p.canRecord} disabled={!p.canView}
                      onChange={(e) => change(p, { canView: p.canView, canRecord: e.target.checked })}
                      className="focus-ring h-4 w-4 accent-[hsl(var(--primary))] disabled:opacity-40"
                      aria-label={`${p.name} can record payments`}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nobody matches that search.</p>}
      </div>
    </div>
  );
}

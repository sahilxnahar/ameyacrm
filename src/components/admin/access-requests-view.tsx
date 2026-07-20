'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Check, X, ShieldCheck, MailWarning, Settings2 } from 'lucide-react';
import { approveAccessRequest, declineAccessRequest, saveSignupConfig } from '@/server/actions/signup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import type { RoleName } from '@prisma/client';

const ROLES: RoleName[] = ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'MANAGER', 'EXECUTIVE', 'EMPLOYEE', 'READ_ONLY', 'GUEST'];
const SELECT = 'h-9 rounded-md border border-input bg-background px-2 text-sm';

interface Req { id: string; name: string; email: string; note: string | null; verified: boolean; requestedAt: string; role: RoleName }
interface Recent { id: string; name: string; email: string; role: RoleName; approvedAt: string }

export function AccessRequestsView({
  requests, recent, config,
}: {
  requests: Req[];
  recent: Recent[];
  config: { domains: string; defaultRole: RoleName; enabled: boolean };
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [roles, setRoles] = React.useState<Record<string, RoleName>>(() => Object.fromEntries(requests.map((r) => [r.id, r.role])));
  const [cfg, setCfg] = React.useState(config);
  const [showCfg, setShowCfg] = React.useState(false);

  const run = (fn: () => Promise<{ ok?: true } | { error: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if ('error' in r && r.error) return toast.error(r.error);
      toast.success(ok);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Who can sign themselves up</p>
            <p className="text-sm text-muted-foreground">
              {cfg.enabled
                ? `Anyone at ${cfg.domains || '(no domains set)'} joins as ${cfg.defaultRole} once they confirm their email. Everybody else appears below for approval.`
                : 'Self sign-up is switched off. Only administrators can create accounts.'}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowCfg((v) => !v)}>
            <Settings2 className="h-4 w-4" /> {showCfg ? 'Close' : 'Change'}
          </Button>
        </div>

        {showCfg && (
          <form
            className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveSignupConfig({ domains: cfg.domains, defaultRole: cfg.defaultRole, enabled: cfg.enabled }), 'Saved');
            }}
          >
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="domains">Trusted domains</Label>
              <Input id="domains" value={cfg.domains} onChange={(e) => setCfg({ ...cfg, domains: e.target.value })} placeholder="ameyaheights.com" />
              <p className="text-xs text-muted-foreground">Comma separated. Leave empty to send every request for approval.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Role they get</Label>
              <select id="role" className={SELECT + ' w-full'} value={cfg.defaultRole} onChange={(e) => setCfg({ ...cfg, defaultRole: e.target.value as RoleName })}>
                {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch id="enabled" checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
              <Label htmlFor="enabled">Allow self sign-up</Label>
            </div>
            <div className="flex items-end justify-end">
              <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
            </div>
          </form>
        )}
      </Card>

      <div>
        <h3 className="mb-3 font-display text-lg font-semibold">Waiting for you ({requests.length})</h3>
        {requests.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">Nothing waiting. Outside requests will land here.</Card>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      {r.name}
                      {r.verified
                        ? <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" /> Email confirmed</Badge>
                        : <Badge variant="outline" className="gap-1"><MailWarning className="h-3 w-3" /> Not confirmed yet</Badge>}
                    </p>
                    <p className="text-sm text-muted-foreground">{r.email}</p>
                    {r.note && <p className="mt-2 max-w-prose text-sm italic">&ldquo;{r.note}&rdquo;</p>}
                    <p className="mt-1 text-xs text-muted-foreground">Requested {new Date(r.requestedAt).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className={SELECT}
                      value={roles[r.id] ?? r.role}
                      onChange={(e) => setRoles({ ...roles, [r.id]: e.target.value as RoleName })}
                      title="The role this person gets if you approve them"
                    >
                      {ROLES.map((x) => <option key={x} value={x}>{x.replace(/_/g, ' ')}</option>)}
                    </select>
                    <Button size="sm" disabled={pending} title="Give this person access with the role selected"
                      onClick={() => run(() => approveAccessRequest(r.id, roles[r.id] ?? r.role), 'Approved — they have been emailed')}>
                      <Check className="h-4 w-4" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" disabled={pending} title="Refuse this request and notify them"
                      onClick={() => run(() => declineAccessRequest(r.id), 'Declined')}>
                      <X className="h-4 w-4" /> Decline
                    </Button>
                  </div>
                </div>
                {!r.verified && (
                  <p className="mt-3 rounded-md bg-warning/10 p-2 text-xs">
                    This person has not clicked their confirmation link yet, so we have not proved they own this mailbox. Approving now skips that check.
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {recent.length > 0 && (
        <div>
          <h3 className="mb-3 font-display text-lg font-semibold">Recently admitted</h3>
          <Card className="divide-y">
            {recent.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span><span className="font-medium">{u.name}</span> <span className="text-muted-foreground">{u.email}</span></span>
                <span className="flex items-center gap-2">
                  <Badge variant="secondary">{u.role.replace(/_/g, ' ')}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(u.approvedAt).toLocaleDateString('en-IN')}</span>
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

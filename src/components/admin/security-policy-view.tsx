'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2, Save, ShieldCheck, ShieldAlert, Smartphone, Globe, XCircle, Clock, Plane } from 'lucide-react';
import { saveSecurityPolicy, setForeignAccess, revokeDevice, extendGrace } from '@/server/actions/security-policy';
import type { SecurityPolicy } from '@/lib/auth/policy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils/cn';

interface Person { id: string; name: string; email: string; role: string; twoFactorEnabled: boolean; graceUntil: string | null; allowForeignAccess: boolean; lastCountry: string | null; lastLoginAt: string | null }
interface Device { id: string; userName: string; label: string | null; country: string | null; ipAddress: string | null; lastSeenAt: string }
interface Failure { id: string; username: string; reason: string | null; country: string | null; ipAddress: string | null; at: string }

export function SecurityPolicyView({
  policy, people, devices, failures,
}: {
  policy: SecurityPolicy; people: Person[]; devices: Device[]; failures: Failure[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [p, setP] = React.useState(policy);
  const [tab, setTab] = React.useState<'policy' | 'people' | 'devices' | 'attempts'>('policy');

  const run = (fn: () => Promise<{ ok?: true; message?: string } | { error: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if ('error' in r && r.error) return toast.error(r.error);
      toast.success(('message' in r && r.message) || ok, { duration: 8000 });
      router.refresh();
    });

  const enrolled = people.filter((x) => x.twoFactorEnabled).length;
  const pct = people.length ? Math.round((enrolled / people.length) * 100) : 0;
  const inGrace = people.filter((x) => !x.twoFactorEnabled && x.graceUntil && new Date(x.graceUntil) > new Date());

  return (
    <div className="space-y-5">
      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat icon={ShieldCheck} label="Two-factor coverage" value={`${pct}%`} hint={`${enrolled} of ${people.length}`} tone={pct === 100 ? 'good' : pct >= 60 ? undefined : 'bad'} />
        <Stat icon={Clock} label="Still in grace" value={String(inGrace.length)} hint={inGrace.length ? 'blocked when it expires' : 'nobody waiting'} />
        <Stat icon={Smartphone} label="Trusted devices" value={String(devices.length)} />
        <Stat icon={ShieldAlert} label="Failed attempts (7d)" value={String(failures.length)} tone={failures.length > 20 ? 'bad' : undefined} />
      </div>

      <div className="chip-row">
        {([['policy', 'Rules'], ['people', 'People'], ['devices', 'Devices'], ['attempts', 'Failed attempts']] as const).map(([k, l]) => (
          <Button key={k} size="sm" variant={tab === k ? 'default' : 'outline'} onClick={() => setTab(k)}>{l}</Button>
        ))}
      </div>

      {tab === 'policy' && (
        <>
          <Card className="p-4">
            <p className="text-sm font-semibold">Two-factor authentication</p>
            <div className="mt-3 space-y-3">
              <Row label="Everyone must use it" hint="The strongest single control. A stolen password stops being enough.">
                <Switch checked={p.require2FA} onCheckedChange={(v) => setP({ ...p, require2FA: v })} />
              </Row>
              <Row label="Admins and managers must use it" hint="Applies when the setting above is off.">
                <Switch checked={p.require2FAForAdmins} disabled={p.require2FA} onCheckedChange={(v) => setP({ ...p, require2FAForAdmins: v })} />
              </Row>
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="grace" className="text-sm">Give people</Label>
                <Input id="grace" type="number" min={0} max={30} className="h-8 w-20" value={p.graceDays}
                  onChange={(e) => setP({ ...p, graceDays: Number(e.target.value) })} />
                <span className="text-sm">days to set it up before they are blocked</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Zero means immediately. Anything above zero means nobody is locked out on the morning you switch this on.
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-sm font-semibold">New devices</p>
            <div className="mt-3 space-y-3">
              <Row label="A new device must be confirmed by email" hint="A six-digit code goes to the person's work address. Until it is entered, no session exists — so a stolen password alone gets nobody in.">
                <Switch checked={p.deviceApproval} onCheckedChange={(v) => setP({ ...p, deviceApproval: v })} />
              </Row>
              <Row label="Email an alert when a new device signs in" hint="Detection rather than blocking. No false lockouts.">
                <Switch checked={p.alertNewDevice} onCheckedChange={(v) => setP({ ...p, alertNewDevice: v })} />
              </Row>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-sm font-semibold">Where people may sign in from</p>
            <div className="mt-3 space-y-3">
              <Row label="Only allow the countries below" hint="Anyone else is refused, unless you allow them individually on the People tab.">
                <Switch checked={p.geoRestrict} onCheckedChange={(v) => setP({ ...p, geoRestrict: v })} />
              </Row>
              <div className="space-y-1.5">
                <Label htmlFor="countries">Allowed countries</Label>
                <Input id="countries" value={p.allowedCountries.join(', ')}
                  onChange={(e) => setP({ ...p, allowedCountries: e.target.value.split(/[\s,]+/).filter(Boolean) })}
                  placeholder="IN, AE, SG" />
                <p className="text-[11px] text-muted-foreground">
                  Two-letter codes. IN is India, AE the UAE, SG Singapore. If the country cannot be determined the
                  sign-in is allowed — never refused on a guess.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-sm font-semibold">Passwords and sessions</p>
            <div className="mt-3 space-y-3">
              <Row label="Refuse passwords found in known breaches" hint="Checked against public breach data. The password never leaves this server — only the first five characters of its hash.">
                <Switch checked={p.breachCheck} onCheckedChange={(v) => setP({ ...p, breachCheck: v })} />
              </Row>
              <Row label="Ask for the password again before risky actions" hint="Changing bank details, approving a large payment, exporting data, changing a role.">
                <Switch checked={p.stepUp} onCheckedChange={(v) => setP({ ...p, stepUp: v })} />
              </Row>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button disabled={pending} onClick={() => run(() => saveSecurityPolicy(p), 'Saved')}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save policy
            </Button>
          </div>
        </>
      )}

      {tab === 'people' && (
        <Card className="table-scroll">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3">Person</th><th className="p-3">Two-factor</th><th className="p-3">Last seen from</th><th className="p-3">Overseas</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {people.map((x) => {
                const grace = x.graceUntil && new Date(x.graceUntil) > new Date();
                return (
                  <tr key={x.id} className="border-b last:border-0">
                    <td className="p-3">{x.name}<span className="block text-xs text-muted-foreground">{x.role.replace(/_/g, ' ').toLowerCase()}</span></td>
                    <td className="p-3">
                      {x.twoFactorEnabled
                        ? <Badge variant="success">on</Badge>
                        : grace
                          ? <Badge variant="warning">grace until {format(new Date(x.graceUntil!), 'd MMM')}</Badge>
                          : <Badge variant="destructive">not set up</Badge>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {x.lastCountry ?? '—'}
                      {x.lastLoginAt && <span className="block">{format(new Date(x.lastLoginAt), 'd MMM, HH:mm')}</span>}
                    </td>
                    <td className="p-3">
                      <button className="text-xs" disabled={pending}
                        title={x.allowForeignAccess ? 'Stop allowing sign-in from abroad' : 'Allow this person to sign in from abroad'}
                        onClick={() => run(() => setForeignAccess(x.id, !x.allowForeignAccess), 'Updated')}>
                        <Badge variant={x.allowForeignAccess ? 'secondary' : 'outline'} className="gap-1">
                          <Plane className="h-3 w-3" /> {x.allowForeignAccess ? 'allowed' : 'India only'}
                        </Badge>
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      {!x.twoFactorEnabled && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pending}
                          title="Give this person another week before they are blocked"
                          onClick={() => run(() => extendGrace(x.id, 7), 'Extended by a week')}>
                          +7 days
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'devices' && (
        <Card className="table-scroll">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3">Person</th><th className="p-3">Device</th><th className="p-3">From</th><th className="p-3">Last used</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-b last:border-0">
                  <td className="p-3 font-medium">{d.userName}</td>
                  <td className="p-3">{d.label ?? 'Unknown device'}</td>
                  <td className="p-3 text-xs text-muted-foreground">{[d.country, d.ipAddress].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="p-3 text-xs text-muted-foreground">{format(new Date(d.lastSeenAt), 'd MMM, HH:mm')}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs text-destructive" disabled={pending}
                      title="Untrust this device and end its sessions — use when a phone is lost"
                      onClick={() => run(() => revokeDevice(d.id), 'Revoked')}>
                      <XCircle className="h-3.5 w-3.5" /> Revoke
                    </Button>
                  </td>
                </tr>
              ))}
              {devices.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No trusted devices yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'attempts' && (
        <Card className="table-scroll">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3">Tried as</th><th className="p-3">Why it failed</th><th className="p-3">From</th><th className="p-3">When</th></tr>
            </thead>
            <tbody>
              {failures.map((f) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="p-3 font-mono text-xs">{f.username}</td>
                  <td className="p-3 text-xs">{(f.reason ?? '').replace(/_/g, ' ')}</td>
                  <td className="p-3 text-xs text-muted-foreground"><Globe className="mr-1 inline h-3 w-3" />{[f.country, f.ipAddress].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="p-3 text-xs text-muted-foreground">{format(new Date(f.at), 'd MMM, HH:mm')}</td>
                </tr>
              ))}
              {failures.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No failed sign-ins this week.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <span className="shrink-0 pt-0.5">{children}</span>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint, tone }: { icon: React.ElementType; label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <Card className="p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</p>
      <p className={cn('font-display text-2xl font-semibold tabular', tone === 'good' && 'text-success', tone === 'bad' && 'text-destructive')}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}

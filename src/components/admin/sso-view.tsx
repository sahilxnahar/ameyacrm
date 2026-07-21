'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import { saveSsoConfig } from '@/server/actions/sso';
import type { SamlConfig } from '@/lib/auth/saml';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'MANAGER', 'EXECUTIVE', 'EMPLOYEE', 'READ_ONLY', 'GUEST'];

export function SsoView({ config, acsUrl }: { config: SamlConfig; acsUrl: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [c, setC] = React.useState(config);

  const copy = (v: string) => { navigator.clipboard?.writeText(v); toast.success('Copied'); };

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" /> Setting it up in Google Workspace</p>
        <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <li>1. admin.google.com → Apps → Web and mobile apps → Add app → <strong>Add custom SAML app</strong></li>
          <li>2. Name it &ldquo;Ameya Heights CRM&rdquo;. Copy the <strong>SSO URL</strong> and <strong>Certificate</strong> Google shows you into the boxes below.</li>
          <li>3. On Google&rsquo;s next screen, paste these two values:</li>
        </ol>
        <div className="mt-3 space-y-2">
          {[['ACS URL', acsUrl], ['Entity ID', c.issuer]].map(([label, val]) => (
            <div key={label} className="flex flex-wrap items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
              <code className="min-w-0 flex-1 truncate rounded bg-secondary px-2 py-1 text-xs">{val}</code>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copy(String(val))}><Copy className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          4. Set Name ID to <strong>Basic Information → Primary email</strong>. Then turn the app on for everyone.
        </p>
        <a href="/api/auth/saml/metadata" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
          View our metadata XML <ExternalLink className="h-3 w-3" />
        </a>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Switch id="enabled" checked={c.enabled} onCheckedChange={(v) => setC({ ...c, enabled: v })} />
            <Label htmlFor="enabled">Single sign-on is {c.enabled ? 'on' : 'off'}</Label>
          </div>
          <Badge variant="secondary">Password login always keeps working</Badge>
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="entryPoint">SSO URL from Google</Label>
            <Input id="entryPoint" value={c.entryPoint} onChange={(e) => setC({ ...c, entryPoint: e.target.value })}
              placeholder="https://accounts.google.com/o/saml2/idp?idpid=..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cert">Certificate from Google</Label>
            <Textarea id="cert" rows={5} value={c.cert} onChange={(e) => setC({ ...c, cert: e.target.value })}
              className="font-mono text-[11px]" placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDdzCC...&#10;-----END CERTIFICATE-----" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="allowedDomains">Domains allowed in</Label>
              <Input id="allowedDomains" value={c.allowedDomains.join(', ')}
                onChange={(e) => setC({ ...c, allowedDomains: e.target.value.split(/[\s,]+/).filter(Boolean) })} />
              <p className="text-[11px] text-muted-foreground">Anyone outside these is refused, whatever Google says.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="defaultRole">Role for a brand-new person</Label>
              <select id="defaultRole" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={c.defaultRole} onChange={(e) => setC({ ...c, defaultRole: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={c.autoProvision} onChange={(e) => setC({ ...c, autoProvision: e.target.checked })} />
            <span>Create an account automatically the first time someone signs in. Turn this off if you would rather add people by hand.</span>
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <Button disabled={pending} onClick={() => start(async () => {
            const r = await saveSsoConfig({ ...c, allowedDomains: c.allowedDomains.join(',') } as unknown as Record<string, string | boolean>);
            if ('error' in r) { toast.error(r.error); return; }
            toast.success(r.message ?? 'Saved', { duration: 9000 });
            router.refresh();
          })}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </Button>
        </div>
      </Card>

      <Card className="p-4 text-sm">
        <p className="font-medium">If it goes wrong</p>
        <p className="mt-1 text-muted-foreground">
          Password sign-in is never disabled, so a broken SAML setup cannot lock anyone out. Test in a private
          window first. If the button does nothing, the certificate is usually the culprit — paste the whole
          block including the BEGIN and END lines.
        </p>
      </Card>
    </div>
  );
}

'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { updateSecurityPolicy } from '@/server/actions/admin-config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

export function SecurityPolicyView({ require2FA, require2FAForAdmins }: { require2FA: boolean; require2FAForAdmins: boolean }) {
  const router = useRouter();
  const [all, setAll] = React.useState(require2FA);
  const [admins, setAdmins] = React.useState(require2FAForAdmins);
  const [pending, start] = React.useTransition();

  const save = (next: { require2FA: boolean; require2FAForAdmins: boolean }) => {
    setAll(next.require2FA); setAdmins(next.require2FAForAdmins);
    start(async () => {
      const r = await updateSecurityPolicy(next);
      if ('error' in r) { toast.error(r.error); router.refresh(); } else toast.success('Security policy updated');
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-primary" /> Two-factor authentication {pending && <Loader2 className="h-4 w-4 animate-spin" />}</CardTitle>
        <CardDescription>Force authenticator-app 2FA. Affected users are sent to a setup screen on their next visit and cannot use the CRM until they enrol.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span><span className="text-sm font-medium">Require 2FA for everyone</span><span className="block text-xs text-muted-foreground">Every staff member must enrol.</span></span>
          <Switch checked={all} disabled={pending} onCheckedChange={(v) => save({ require2FA: v, require2FAForAdmins: admins })} />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span><span className="text-sm font-medium">Require 2FA for admins</span><span className="block text-xs text-muted-foreground">Super Admin &amp; Admin roles must enrol (recommended).</span></span>
          <Switch checked={admins} disabled={pending} onCheckedChange={(v) => save({ require2FA: all, require2FAForAdmins: v })} />
        </label>
      </CardContent>
    </Card>
  );
}

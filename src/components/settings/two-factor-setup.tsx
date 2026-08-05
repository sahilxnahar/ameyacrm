'use client';
import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, ShieldOff, Copy } from 'lucide-react';
import { startTwoFactorSetup, confirmTwoFactor, disableTwoFactor } from '@/server/actions/security';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PasswordDialog } from '@/components/ui/password-dialog';

export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [qr, setQr] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [code, setCode] = React.useState('');
  const [backup, setBackup] = React.useState<string[] | null>(null);

  /**
   * AMH-071 — `window.prompt` is gone from this component.
   *
   * It is blocked in sandboxed frames and by the browser's "prevent additional
   * dialogs" checkbox, and when it is blocked it returns null silently — so
   * "Disable 2FA" simply did nothing, with no error, on a browser where the
   * user had ticked that box once on some other site.
   */
  const [ask, setAsk] = React.useState<null | 'disable' | 're-enrol'>(null);

  const begin = (password?: string) => start(async () => {
    const res = await startTwoFactorSetup(password);
    if ('error' in res) {
      // AMH-052: replacing a second factor that already works costs a password.
      if (res.error === 'PASSWORD_REQUIRED') { setAsk('re-enrol'); return; }
      toast.error(res.error);
      return;
    }
    setAsk(null);
    setQr(res.qr); setSecret(res.secret);
  });

  const confirm = () => start(async () => {
    const res = await confirmTwoFactor(code);
    if ('error' in res) { toast.error(res.error); return; }
    setBackup(res.backupCodes); setQr(null); setCode(''); toast.success('Two-factor enabled'); router.refresh();
  });

  const disable = (pw: string) => start(async () => {
    const res = await disableTwoFactor(pw);
    if ('error' in res) { toast.error(res.error); return; }
    setAsk(null);
    toast.success('Two-factor disabled'); router.refresh();
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="min-w-0 truncate text-base sm:text-lg"><ShieldCheck className="mr-2 inline h-4 w-4" />Two-factor authentication</CardTitle>
          <CardDescription>Time-based one-time passwords (TOTP).</CardDescription>
        </div>
        <Badge variant={enabled ? 'success' : 'secondary'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
      </CardHeader>
      <CardContent>
        {enabled && !qr ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setAsk('disable')} disabled={pending}><ShieldOff className="h-4 w-4" /> Disable 2FA</Button>
            {/*
              AMH-070 — a new phone. This used to be unreachable, so the only
              way to move your authenticator was Disable then Enable, which
              leaves the account with no second factor in between. Starting an
              enrolment here parks the new secret; the one on your old phone
              keeps working until you confirm a code from the new one.
            */}
            <Button variant="ghost" onClick={() => setAsk('re-enrol')} disabled={pending}><ShieldCheck className="h-4 w-4" /> Set up a new authenticator</Button>
          </div>
        ) : backup ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-success">2FA is on. Save these one-time backup codes:</p>
            <div className="grid grid-cols-2 gap-2 rounded-md border bg-secondary/40 p-3 font-mono text-sm">
              {backup.map((c) => <span key={c}>{c}</span>)}
            </div>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(backup.join('\n')); toast.success('Copied'); }}><Copy className="h-4 w-4" /> Copy codes</Button>
          </div>
        ) : qr ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <Image src={qr} alt="TOTP QR" width={180} height={180} className="rounded-md border bg-white p-2" />
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">Scan with Google Authenticator / Authy, or enter this secret:</p>
                <code className="block break-all rounded bg-secondary px-2 py-1 text-xs">{secret}</code>
                <div className="flex gap-2 pt-2">
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" className="w-40" />
                  <Button onClick={confirm} disabled={pending || code.length < 6}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Verify</Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Button onClick={() => begin()} disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}<ShieldCheck className="h-4 w-4" /> Enable 2FA</Button>
        )}
      </CardContent>

      <PasswordDialog
        open={ask !== null}
        title={ask === 'disable' ? 'Turn off two-factor authentication' : 'Set up a new authenticator'}
        description={ask === 'disable'
          ? 'This removes the second factor and your backup codes. Confirm your password to continue.'
          : 'Your current authenticator keeps working until you scan the new code and confirm it.'}
        confirmLabel={ask === 'disable' ? 'Turn it off' : 'Continue'}
        destructive={ask === 'disable'}
        pending={pending}
        onCancel={() => setAsk(null)}
        onConfirm={(pw) => (ask === 'disable' ? disable(pw) : begin(pw))}
      />
    </Card>
  );
}

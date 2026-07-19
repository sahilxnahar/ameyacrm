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

export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [qr, setQr] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [code, setCode] = React.useState('');
  const [backup, setBackup] = React.useState<string[] | null>(null);

  const begin = () => start(async () => {
    const res = await startTwoFactorSetup();
    if ('error' in res) return toast.error(res.error);
    setQr(res.qr); setSecret(res.secret);
  });
  const confirm = () => start(async () => {
    const res = await confirmTwoFactor(code);
    if ('error' in res) return toast.error(res.error);
    setBackup(res.backupCodes); setQr(null); toast.success('Two-factor enabled'); router.refresh();
  });
  const disable = () => {
    const pw = prompt('Confirm your password to disable 2FA:');
    if (!pw) return;
    start(async () => {
      const res = await disableTwoFactor(pw);
      if ('error' in res) return toast.error(res.error);
      toast.success('Two-factor disabled'); router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg"><ShieldCheck className="mr-2 inline h-4 w-4" />Two-factor authentication</CardTitle>
          <CardDescription>Time-based one-time passwords (TOTP).</CardDescription>
        </div>
        <Badge variant={enabled ? 'success' : 'secondary'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
      </CardHeader>
      <CardContent>
        {enabled ? (
          <Button variant="outline" onClick={disable} disabled={pending}><ShieldOff className="h-4 w-4" /> Disable 2FA</Button>
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
          <Button onClick={begin} disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}<ShieldCheck className="h-4 w-4" /> Enable 2FA</Button>
        )}
      </CardContent>
    </Card>
  );
}

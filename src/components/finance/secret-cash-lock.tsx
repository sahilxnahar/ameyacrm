'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Lock, Loader2, ShieldCheck, Send } from 'lucide-react';
import { requestSecretOtp, verifySecretOtp } from '@/server/actions/secret-cashbook';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SecretCashLock() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [sent, setSent] = React.useState(false);
  const [code, setCode] = React.useState('');

  const sendCode = () => start(async () => {
    const r = await requestSecretOtp();
    if ('error' in r) { toast.error(r.error); return; }
    setSent(true);
    toast.success(`Code sent via ${r.sentTo?.join(' & ') ?? 'email'}`);
  });

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await verifySecretOtp(code.trim());
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Unlocked'); router.refresh();
    });
  };

  return (
    <Card className="mx-auto max-w-md p-6 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Lock className="h-7 w-7" />
      </div>
      <p className="text-lg font-semibold">This cash book is locked</p>
      <p className="mt-1 text-sm text-muted-foreground">
        For your security, opening it needs a one-time code sent to your email and WhatsApp. It re-locks itself after a while.
      </p>

      {!sent ? (
        <Button className="mt-4 w-full" onClick={sendCode} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send me a code
        </Button>
      ) : (
        <form onSubmit={verify} className="mt-4 space-y-3">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="Enter the 6-digit code"
            className="text-center text-lg tracking-[0.3em]"
            autoFocus
          />
          <Button type="submit" className="w-full" disabled={pending || code.length < 6}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Open
          </Button>
          <button type="button" onClick={sendCode} disabled={pending} className="text-xs text-muted-foreground hover:text-foreground">
            Didn’t get it? Send again
          </button>
        </form>
      )}
    </Card>
  );
}

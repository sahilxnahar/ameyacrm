'use client';
import * as React from 'react';
import { useActionState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { verifyDeviceAction, type DeviceState } from '@/server/actions/device';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function DeviceCheckForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<DeviceState, FormData>(verifyDeviceAction, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1.5">
        <Label htmlFor="code">Six-digit code</Label>
        <Input
          id="code" name="code" inputMode="numeric" autoComplete="one-time-code"
          maxLength={6} required autoFocus placeholder="123456"
          className="text-center font-mono text-xl tracking-[0.4em]"
        />
      </div>
      {state.error && <p role="alert" className="text-sm font-medium text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Confirm and sign in
      </Button>
      <p className="text-xs">
        This device will be remembered for 30 days. If you did not try to sign in, someone has your password —
        change it and tell an administrator.
      </p>
    </form>
  );
}

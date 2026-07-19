'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { verifyTwoFactorAction, type ActionState } from '@/server/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
      Verify
    </Button>
  );
}

export function TwoFactorForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(verifyTwoFactorAction, {});
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="font-display text-3xl font-semibold">Two-factor verification</h2>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app, or a backup code.
        </p>
      </div>
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code">Verification code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            placeholder="123 456"
            className="text-center text-lg tracking-[0.3em]"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="trustDevice" className="accent-[hsl(var(--primary))]" />
          Trust this device for 30 days
        </label>
        {state.error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}
        <SubmitButton />
      </form>
    </div>
  );
}

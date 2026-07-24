'use client';
import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { verifyTwoFactorAction, sendEmailSignInCodeAction, type ActionState } from '@/server/actions/auth';
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
  const [emailState, setEmailState] = useState<ActionState | null>(null);
  const [sending, startSend] = useTransition();

  const emailMeACode = () =>
    startSend(async () => setEmailState(await sendEmailSignInCodeAction()));
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="font-display text-3xl font-semibold">Two-factor verification</h2>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app, a backup code, or a code sent to your email.
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

      <div className="space-y-2 border-t border-border pt-4">
        <button
          type="button" onClick={emailMeACode} disabled={sending}
          className="focus-ring w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
        >
          {sending ? 'Sending…' : 'Email me a code instead'}
        </button>
        <p className="text-xs text-muted-foreground">
          Useful if your phone is not to hand. The code lasts ten minutes.
        </p>
        {emailState?.success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{emailState.success}</p>}
        {emailState?.error && <p role="alert" className="text-sm text-destructive">{emailState.error}</p>}
      </div>
    </div>
  );
}

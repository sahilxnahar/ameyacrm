'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, LogIn } from 'lucide-react';
import { loginAction, type ActionState } from '@/server/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
      Sign in
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(loginAction, {});
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="font-display text-3xl font-semibold">Welcome back</h2>
        <p className="text-sm text-muted-foreground">Sign in with your username or email.</p>
      </div>
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="identifier">Username or email</Label>
          <Input id="identifier" name="identifier" autoComplete="username" autoFocus required placeholder="e.g. superadmin" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••••••" />
        </div>
        {state.error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}
        <SubmitButton />
      </form>
      <p className="text-center text-xs text-muted-foreground">
        Protected by 2FA, device recognition &amp; audit logging.
      </p>
    </div>
  );
}

'use client';
import * as React from 'react';
import { useActionState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { signupAction, type SignupState } from '@/server/actions/signup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(signupAction, {});

  if (state.ok) {
    return (
      <div className="rounded-md border border-success/40 bg-success/10 p-4">
        <p className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4" /> Request received</p>
        <p className="mt-1 text-sm">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" autoComplete="name" required placeholder="Praveen Kumar" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@ameyaheights.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Choose a password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="At least 8 characters" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="note">Who are you? <span className="font-normal opacity-70">(optional — helps if you are outside the company)</span></Label>
        <Textarea id="note" name="note" rows={2} placeholder="Contractor working on the Basaveshwar Nagar site" />
      </div>
      {state.error && <p role="alert" className="text-sm font-medium text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Request access
      </Button>
    </form>
  );
}

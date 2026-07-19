'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, KeyRound } from 'lucide-react';
import { changePassword } from '@/server/actions/security';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ChangePassword() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.get('next') !== fd.get('confirm')) return toast.error('Passwords do not match.');
    start(async () => {
      const res = await changePassword({ current: fd.get('current'), next: fd.get('next') });
      if ('error' in res) return toast.error(res.error);
      toast.success('Password updated'); (e.target as HTMLFormElement).reset(); router.refresh();
    });
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg"><KeyRound className="mr-2 inline h-4 w-4" />Password</CardTitle><CardDescription>Minimum 12 characters with upper, lower, number & symbol.</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2"><Label htmlFor="current">Current</Label><Input id="current" name="current" type="password" required /></div>
          <div className="space-y-2"><Label htmlFor="next">New</Label><Input id="next" name="next" type="password" required /></div>
          <div className="space-y-2"><Label htmlFor="confirm">Confirm</Label><Input id="confirm" name="confirm" type="password" required /></div>
          <div className="sm:col-span-3"><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Update password</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus, Loader2 } from 'lucide-react';
import { createLead } from '@/server/actions/sales';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function QuickAddLead() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form);
    start(async () => {
      const r = await createLead({ name: fd.get('name'), phone: fd.get('phone') || undefined, source: 'WALK_IN' });
      if ('error' in r) return toast.error(r.error);
      toast.success('Lead added'); form.reset(); router.refresh();
    });
  };
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary"><UserPlus className="h-4 w-4" /></span>
        <p className="text-sm font-medium">Quick add lead</p>
      </div>
      <form onSubmit={submit} className="flex flex-1 flex-col justify-center gap-2 p-4">
        <p className="text-xs text-muted-foreground">Capture a walk-in or phone enquiry in seconds.</p>
        <Input name="name" placeholder="Full name" required />
        <Input name="phone" placeholder="Phone" inputMode="tel" />
        <Button type="submit" className="w-full" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Add lead</Button>
      </form>
    </Card>
  );
}

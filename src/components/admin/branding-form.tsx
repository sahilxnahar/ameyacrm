'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { updateBranding } from '@/server/actions/admin-config';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function BrandingForm({ initial }: { initial: { displayName: string; tagline: string; primaryColor: string; supportEmail: string } }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await updateBranding({ displayName: fd.get('displayName'), tagline: fd.get('tagline'), primaryColor: fd.get('primaryColor'), supportEmail: fd.get('supportEmail') });
      if ('error' in r) return toast.error(r.error);
      toast.success('Branding saved'); router.refresh();
    });
  };
  return (
    <Card className="max-w-xl"><CardContent className="p-6">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="displayName">Company name</Label><Input id="displayName" name="displayName" defaultValue={initial.displayName} /></div>
        <div className="space-y-2"><Label htmlFor="tagline">Tagline</Label><Input id="tagline" name="tagline" defaultValue={initial.tagline} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="primaryColor">Accent colour (hex)</Label><Input id="primaryColor" name="primaryColor" defaultValue={initial.primaryColor} placeholder="#A07D34" /></div>
          <div className="space-y-2"><Label htmlFor="supportEmail">Support email</Label><Input id="supportEmail" name="supportEmail" type="email" defaultValue={initial.supportEmail} /></div>
        </div>
        <p className="text-xs text-muted-foreground">Saved to settings. Name & tagline apply where shown; full colour theming reads these on next deploy.</p>
        <Button type="submit" disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save branding</Button>
      </form>
    </CardContent></Card>
  );
}

'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Percent } from 'lucide-react';
import { updateCollectionsSettings } from '@/server/actions/admin-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CollectionsSettingsView({ interestPct, defaultGstPct }: { interestPct: number; defaultGstPct: number }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    start(async () => { const r = await updateCollectionsSettings({ interestPct: fd.get('interestPct'), defaultGstPct: fd.get('defaultGstPct') }); if ('error' in r) { toast.error(r.error); return; } toast.success('Settings saved'); router.refresh(); });
  };
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Percent className="h-5 w-5 text-primary" /> Collections & tax</CardTitle><CardDescription>Used by the late-payment automation and cost-sheet/invoice defaults.</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="max-w-sm space-y-4">
          <div className="space-y-1"><Label htmlFor="interestPct">Late-payment interest (% per annum)</Label><Input id="interestPct" name="interestPct" type="number" step="0.1" min="0" max="60" defaultValue={interestPct} /></div>
          <div className="space-y-1"><Label htmlFor="defaultGstPct">Default GST (%)</Label><Input id="defaultGstPct" name="defaultGstPct" type="number" step="0.1" min="0" max="28" defaultValue={defaultGstPct} /></div>
          <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save settings</Button>
        </form>
      </CardContent>
    </Card>
  );
}

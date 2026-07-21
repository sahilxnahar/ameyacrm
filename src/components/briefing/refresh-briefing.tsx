'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RefreshCw, Loader2 } from 'lucide-react';
import { refreshBriefing } from '@/server/actions/briefing';
import { Button } from '@/components/ui/button';

export function RefreshBriefing() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button size="sm" disabled={pending} onClick={() => start(async () => {
      const r = await refreshBriefing();
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Briefing regenerated'); router.refresh();
    })}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
    </Button>
  );
}

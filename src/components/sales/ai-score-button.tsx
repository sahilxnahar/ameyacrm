'use client';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Sparkles, Loader2 } from 'lucide-react';
import { scoreLead } from '@/server/actions/sales';
import { Button } from '@/components/ui/button';

export function AiScoreButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button size="sm" variant="outline" className="w-full" disabled={pending}
      onClick={() => start(async () => { const r = await scoreLead(leadId); if ('error' in r) { toast.error(r.error); return; } toast.success('Lead scored by AI'); router.refresh(); })}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Score with AI
    </Button>
  );
}

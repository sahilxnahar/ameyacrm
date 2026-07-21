'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { advanceWorkRequest, commentWorkRequest } from '@/server/actions/workrequests';
import { nextStatuses, wrActionLabel, type WRSide, type WRStatus } from '@/lib/workrequests/lifecycle';
import { Button } from '@/components/ui/button';

export function WorkRequestDetailPanel({
  id, status, side, canAct,
}: {
  id: string;
  status: string;
  side: WRSide | null;
  canAct: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [body, setBody] = React.useState('');

  const moves = side && canAct ? nextStatuses(status as WRStatus, side) : [];

  const act = (to: WRStatus) => start(async () => {
    const r = await advanceWorkRequest(id, to);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success(r.message); router.refresh();
  });

  const comment = (e: React.FormEvent) => {
    e.preventDefault();
    if (body.trim().length < 1) return;
    start(async () => {
      const r = await commentWorkRequest(id, body);
      if ('error' in r) { toast.error(r.error); return; }
      setBody(''); router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {moves.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {moves.map((to) => (
            <Button key={to} size="sm" variant={to === 'REJECTED' || to === 'SENT_BACK' ? 'ghost' : 'default'} disabled={pending} onClick={() => act(to)}>
              {wrActionLabel(to)}
            </Button>
          ))}
        </div>
      )}
      <form onSubmit={comment} className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Add a comment…"
          className="focus-ring w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <Button type="submit" size="sm" variant="outline" disabled={pending || body.trim().length < 1}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Comment
        </Button>
      </form>
    </div>
  );
}

'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, X, HelpCircle, Flag } from 'lucide-react';
import { respondToAssignment } from '@/server/actions/tasks';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AssigneeStateBadge } from './badges';
import type { AssigneeState } from '@prisma/client';

export function AssignmentActions({ taskId, state, progress }: { taskId: string; state: AssigneeState; progress: number }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [reason, setReason] = React.useState('');
  const [mode, setMode] = React.useState<'REJECT' | 'CLARIFY' | null>(null);

  const run = (action: 'ACCEPT' | 'REJECT' | 'CLARIFY' | 'COMPLETE') => {
    start(async () => {
      const res = await respondToAssignment({ taskId, action, reason });
      if ('error' in res) { toast.error(res.error); return; }
      toast.success('Updated');
      setMode(null); setReason('');
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border bg-secondary/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">Your assignment</p>
        <AssigneeStateBadge state={state} />
      </div>
      {mode ? (
        <div className="space-y-2">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={mode === 'REJECT' ? 'Reason for rejecting…' : 'What do you need clarified?'} />
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={() => run(mode)}>Submit</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending || state === 'ACCEPTED'} onClick={() => run('ACCEPT')}><Check className="h-4 w-4" /> Accept</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setMode('CLARIFY')}><HelpCircle className="h-4 w-4" /> Clarify</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setMode('REJECT')}><X className="h-4 w-4" /> Reject</Button>
          <Button size="sm" variant="secondary" disabled={pending || state === 'COMPLETED'} onClick={() => run('COMPLETE')}><Flag className="h-4 w-4" /> Mark complete</Button>
        </div>
      )}
      {progress > 0 && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full brass-gradient" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

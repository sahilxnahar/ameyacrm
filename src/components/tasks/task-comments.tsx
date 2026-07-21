'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { addTaskComment } from '@/server/actions/tasks';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { initials, timeAgo } from '@/lib/utils/format';

export function TaskComments({ taskId, comments }: { taskId: string; comments: { id: string; body: string; authorName: string; createdAt: string }[] }) {
  const router = useRouter();
  const [body, setBody] = React.useState('');
  const [pending, start] = React.useTransition();

  const submit = () => {
    if (!body.trim()) return;
    start(async () => {
      const res = await addTaskComment(taskId, body);
      if ('error' in res) { toast.error(res.error); return; }
      setBody('');
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar className="h-8 w-8"><AvatarFallback className="text-[10px]">{initials(c.authorName)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm"><span className="font-medium">{c.authorName}</span> <span className="text-xs text-muted-foreground">· {timeAgo(c.createdAt)}</span></p>
              <p className="whitespace-pre-wrap text-sm text-foreground/90">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a comment… use @username to mention" className="min-h-[60px]" />
        <Button onClick={submit} disabled={pending} size="icon" className="h-auto"><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

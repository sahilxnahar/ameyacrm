'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Milestone } from 'lucide-react';
import { toggleChecklistItem } from '@/server/actions/tasks';

export function TaskChecklist({ items }: { items: { id: string; text: string; isDone: boolean; isMilestone: boolean }[] }) {
  const router = useRouter();
  const [, start] = React.useTransition();
  const done = items.filter((i) => i.isDone).length;

  return (
    <div className="space-y-2">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full brass-gradient" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </div>
        {done}/{items.length}
      </div>
      {items.map((item) => (
        <label key={item.id} className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            defaultChecked={item.isDone}
            className="accent-[hsl(var(--primary))]"
            onChange={(e) => start(async () => { await toggleChecklistItem(item.id, e.target.checked); router.refresh(); })}
          />
          <span className={item.isDone ? 'text-muted-foreground line-through' : ''}>{item.text}</span>
          {item.isMilestone && <Milestone className="h-3.5 w-3.5 text-primary" />}
        </label>
      ))}
    </div>
  );
}

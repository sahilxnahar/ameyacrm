'use client';
import * as React from 'react';
import Link from 'next/link';
import {
  DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { CalendarDays } from 'lucide-react';
import { moveTask } from '@/server/actions/tasks';
import { PriorityBadge } from './badges';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDate, initials } from '@/lib/utils/format';
import { titleCase } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { BoardTask } from '@/server/services/task-service';

const COLUMNS = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE'] as const;
type Col = (typeof COLUMNS)[number];

function Card({ task }: { task: BoardTask }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn('cursor-grab rounded-lg border bg-card p-3 shadow-sm active:cursor-grabbing', isDragging && 'opacity-50 ring-2 ring-primary')}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">{task.reference}</span>
        <PriorityBadge priority={task.priority as never} />
      </div>
      <Link href={`/tasks/${task.id}`} onClick={(e) => e.stopPropagation()} className="line-clamp-2 text-sm font-medium hover:text-primary">
        {task.title}
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex -space-x-2">
          {task.assignees.slice(0, 3).map((a, i) => (
            <Avatar key={i} className="h-6 w-6 border-2 border-card"><AvatarFallback className="text-[9px]">{initials(a.name)}</AvatarFallback></Avatar>
          ))}
        </div>
        {task.dueDate && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <CalendarDays className="h-3 w-3" />{formatDate(task.dueDate, 'dd MMM')}
          </span>
        )}
      </div>
    </div>
  );
}

function Column({ id, tasks }: { id: Col; tasks: BoardTask[] }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titleCase(id)}</h3>
        <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div ref={setNodeRef} className={cn('flex min-h-32 flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors', isOver ? 'border-primary bg-primary/5' : 'border-border')}>
        {tasks.map((t) => <Card key={t.id} task={t} />)}
      </div>
    </div>
  );
}

export function TaskBoard({ tasks: initial }: { tasks: BoardTask[] }) {
  const [tasks, setTasks] = React.useState(initial);
  React.useEffect(() => setTasks(initial), [initial]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    const taskId = String(e.active.id);
    const target = e.over?.id as Col | undefined;
    if (!target) return;
    const current = tasks.find((t) => t.id === taskId);
    if (!current || current.status === target) return;

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: target } : t)));
    const position = tasks.filter((t) => t.status === target).length;
    const res = await moveTask(taskId, target as never, position);
    if ('error' in res) {
      toast.error(res.error);
      setTasks(initial); // rollback
    } else {
      toast.success(`Moved ${current.reference} → ${titleCase(target)}`);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((c) => <Column key={c} id={c} tasks={tasks.filter((t) => t.status === c)} />)}
      </div>
    </DndContext>
  );
}

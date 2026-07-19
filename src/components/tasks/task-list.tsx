'use client';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PriorityBadge, StatusBadge } from './badges';
import { formatDate, initials } from '@/lib/utils/format';
import type { BoardTask } from '@/server/services/task-service';

export function TaskList({ tasks }: { tasks: BoardTask[] }) {
  if (tasks.length === 0) return <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No tasks yet. Create your first task.</p>;
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ref</TableHead><TableHead>Title</TableHead><TableHead>Status</TableHead>
            <TableHead>Priority</TableHead><TableHead>Due</TableHead><TableHead>Assignees</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((t) => (
            <TableRow key={t.id} className="cursor-pointer">
              <TableCell className="font-mono text-xs text-muted-foreground">{t.reference}</TableCell>
              <TableCell><Link href={`/tasks/${t.id}`} className="font-medium hover:text-primary">{t.title}</Link></TableCell>
              <TableCell><StatusBadge status={t.status as never} /></TableCell>
              <TableCell><PriorityBadge priority={t.priority as never} /></TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(t.dueDate, 'dd MMM yyyy')}</TableCell>
              <TableCell>
                <div className="flex -space-x-2">
                  {t.assignees.slice(0, 4).map((a, i) => (
                    <Avatar key={i} className="h-6 w-6 border-2 border-background"><AvatarFallback className="text-[9px]">{initials(a.name)}</AvatarFallback></Avatar>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

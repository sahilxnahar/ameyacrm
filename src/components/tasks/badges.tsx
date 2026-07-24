import { Badge } from '@/components/ui/badge';
import { titleCase } from '@/lib/utils/format';
import type { Priority, TaskStatus, AssigneeState } from '@prisma/client';

export function PriorityBadge({ priority }: { priority: Priority }) {
  const map: Record<Priority, 'secondary' | 'default' | 'warning' | 'destructive'> = {
    LOW: 'secondary', MEDIUM: 'default', HIGH: 'warning', URGENT: 'destructive',
  };
  return <Badge variant={map[priority]}>{titleCase(priority)}</Badge>;
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, 'secondary' | 'default' | 'success' | 'warning' | 'destructive'> = {
    BACKLOG: 'secondary', TODO: 'secondary', IN_PROGRESS: 'default', IN_REVIEW: 'warning',
    BLOCKED: 'destructive', DONE: 'success', CANCELLED: 'secondary',
  };
  return <Badge variant={map[status]}>{titleCase(status)}</Badge>;
}

export function AssigneeStateBadge({ state }: { state: AssigneeState }) {
  const map: Record<AssigneeState, 'secondary' | 'default' | 'success' | 'warning' | 'destructive'> = {
    ASSIGNED: 'secondary', ACCEPTED: 'default', REJECTED: 'destructive',
    CLARIFICATION_REQUESTED: 'warning', COMPLETED: 'success',
  };
  return <Badge variant={map[state]}>{titleCase(state)}</Badge>;
}

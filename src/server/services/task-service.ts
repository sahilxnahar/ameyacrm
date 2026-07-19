import 'server-only';
import { prisma } from '@/lib/db/prisma';

export interface BoardTask {
  id: string; reference: string; title: string; priority: string; status: string;
  dueDate: string | null; assignees: { name: string; avatarUrl: string | null }[];
  labels: { name: string; color: string }[];
}

export async function listBoardTasks(): Promise<BoardTask[]> {
  const tasks = await prisma.task.findMany({
    where: { deletedAt: null, parentId: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    take: 300,
    include: {
      assignees: { include: { user: { select: { name: true, avatarUrl: true } } } },
      labels: { include: { label: true } },
    },
  });
  return tasks.map((t) => ({
    id: t.id, reference: t.reference, title: t.title, priority: t.priority, status: t.status,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    assignees: t.assignees.map((a) => ({ name: a.user.name, avatarUrl: a.user.avatarUrl })),
    labels: t.labels.map((l) => ({ name: l.label.name, color: l.label.color })),
  }));
}

export async function getTaskDetail(id: string) {
  return prisma.task.findFirst({
    where: { id, deletedAt: null },
    include: {
      project: { select: { name: true } },
      department: { select: { name: true } },
      createdBy: { select: { name: true, avatarUrl: true } },
      assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      checklistItems: { orderBy: { position: 'asc' } },
      comments: { orderBy: { createdAt: 'asc' }, include: { author: { select: { name: true, avatarUrl: true } } } },
      activities: { orderBy: { createdAt: 'desc' }, take: 30, include: { actor: { select: { name: true } } } },
      labels: { include: { label: true } },
      subtasks: { select: { id: true, reference: true, title: true, status: true } },
      dependsOn: { include: { dependsOn: { select: { id: true, reference: true, title: true, status: true } } } },
    },
  });
}

export async function getAssignableUsers() {
  return prisma.user.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    select: { id: true, name: true, department: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
}

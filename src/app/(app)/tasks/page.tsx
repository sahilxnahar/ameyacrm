import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { listBoardTasks, getAssignableUsers } from '@/server/services/task-service';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { TasksView } from '@/components/tasks/tasks-view';
import { PageLoadError } from '@/components/layout/page-load-error';

export const metadata: Metadata = { title: 'Tasks' };

export default async function TasksPage() {
  await requirePermission('task.view');

  let data;
  try {
    const [tasks, users, departments, projects] = await Promise.all([
      listBoardTasks(),
      getAssignableUsers(),
      prisma.department.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    ]);
    data = { tasks, users, departments, projects };
  } catch (e) {
    return (
      <div>
        <PageHeader title="Tasks" description="Assign, track and complete work across every department." />
        <PageLoadError error={e} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Tasks" description="Assign, track and complete work across every department." />
      <TasksView tasks={data.tasks} users={data.users} departments={data.departments} projects={data.projects} />
    </div>
  );
}

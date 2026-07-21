'use client';
import * as React from 'react';
import { LayoutGrid, List, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TaskBoard } from './task-board';
import { TaskList } from './task-list';
import { NewTaskDialog } from './new-task-dialog';
import type { BoardTask } from '@/server/services/task-service';

interface Option { id: string; name: string }

export function TasksView({
  tasks, users, departments, projects,
}: {
  tasks: BoardTask[];
  users: { id: string; name: string; department: { name: string } | null }[];
  departments: Option[];
  projects: Option[];
}) {
  const [view, setView] = React.useState<'board' | 'list'>('board');
  const [newOpen, setNewOpen] = React.useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex rounded-md border p-0.5">
          <Button variant={view === 'board' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('board')}>
            <LayoutGrid className="h-4 w-4" /> Board
          </Button>
          <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('list')}>
            <List className="h-4 w-4" /> List
          </Button>
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New task</Button>
      </div>

      {view === 'board' ? <TaskBoard tasks={tasks} /> : <TaskList tasks={tasks} people={users.map((u) => ({ id: u.id, name: u.name }))} />}

      <NewTaskDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        users={users}
        departments={departments}
        projects={projects}
      />
    </div>
  );
}

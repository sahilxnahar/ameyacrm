'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { createTask } from '@/server/actions/tasks';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Option { id: string; name: string }
const selectCls = 'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function NewTaskDialog({
  open, onOpenChange, users, departments, projects,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  users: { id: string; name: string; department: { name: string } | null }[];
  departments: Option[];
  projects: Option[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [assignees, setAssignees] = React.useState<string[]>([]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      title: String(fd.get('title') || ''),
      description: String(fd.get('description') || ''),
      priority: String(fd.get('priority') || 'MEDIUM'),
      status: String(fd.get('status') || 'TODO'),
      departmentId: String(fd.get('departmentId') || '') || null,
      projectId: String(fd.get('projectId') || '') || null,
      dueDate: String(fd.get('dueDate') || '') || null,
      estimateMins: fd.get('estimateMins') ? Number(fd.get('estimateMins')) : null,
      assigneeIds: assignees,
    };
    start(async () => {
      const res = await createTask(input);
      if ('error' in res) { toast.error(res.error); return; }
      toast.success('Task created');
      onOpenChange(false);
      setAssignees([]);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>Create a task and assign it to one or more people.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="e.g. Issue Rev-C elevation drawings" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" placeholder="Context, acceptance criteria…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <select id="priority" name="priority" className={selectCls} defaultValue="MEDIUM">
                <option value="LOW">Low</option><option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option><option value="URGENT">Urgent</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select id="status" name="status" className={selectCls} defaultValue="TODO">
                <option value="BACKLOG">Backlog</option><option value="TODO">To do</option>
                <option value="IN_PROGRESS">In progress</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="departmentId">Department</Label>
              <select id="departmentId" name="departmentId" className={selectCls} defaultValue="">
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectId">Project</Label>
              <select id="projectId" name="projectId" className={selectCls} defaultValue="">
                <option value="">—</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" name="dueDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimateMins">Estimate (mins)</Label>
              <Input id="estimateMins" name="estimateMins" type="number" min={0} placeholder="e.g. 120" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Assignees</Label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
              {users.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-secondary">
                  <input
                    type="checkbox"
                    className="accent-[hsl(var(--primary))]"
                    checked={assignees.includes(u.id)}
                    onChange={(ev) => setAssignees((prev) => ev.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id))}
                  />
                  {u.name}
                  {u.department && <span className="text-xs text-muted-foreground">· {u.department.name}</span>}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Create task</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

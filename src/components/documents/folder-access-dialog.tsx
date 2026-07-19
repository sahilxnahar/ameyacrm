'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Trash2, Shield } from 'lucide-react';
import { setFolderPermission, removeFolderPermission } from '@/server/actions/documents';
import { ROLE_LABELS } from '@/lib/rbac/roles';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { titleCase } from '@/lib/utils/format';

const selectCls = 'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm';
const ROLES = ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'MANAGER', 'EXECUTIVE', 'EMPLOYEE', 'READ_ONLY', 'GUEST'];
interface Perm { id: string; level: string; who: string; kind: string }

export function FolderAccessDialog({ open, onOpenChange, folderId, folderName, permissions, users, departments }: {
  open: boolean; onOpenChange: (v: boolean) => void; folderId: string; folderName: string;
  permissions: Perm[]; users: { id: string; name: string }[]; departments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [principalType, setPrincipalType] = React.useState<'user' | 'department' | 'role'>('user');

  const add = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await setFolderPermission({ folderId, principalType, userId: fd.get('userId'), departmentId: fd.get('departmentId'), role: fd.get('role'), level: fd.get('level') });
      if ('error' in r) return toast.error(r.error);
      toast.success('Access granted'); router.refresh();
    });
  };
  const remove = (id: string) => start(async () => { const r = await removeFolderPermission(id); if ('error' in r) return toast.error(r.error); toast.success('Access revoked'); router.refresh(); });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Access — {folderName}</DialogTitle><DialogDescription>Grant view/edit/manage rights to users, departments or roles.</DialogDescription></DialogHeader>

        <div className="space-y-2">
          {permissions.length === 0 && <p className="text-sm text-muted-foreground">No explicit permissions — inherits defaults.</p>}
          {permissions.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span><Badge variant="outline" className="mr-2">{p.kind}</Badge>{p.who}</span>
              <span className="flex items-center gap-2"><Badge variant="secondary">{titleCase(p.level)}</Badge><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button></span>
            </div>
          ))}
        </div>

        <form onSubmit={add} className="space-y-3 rounded-lg border bg-secondary/30 p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Grant to</Label>
              <select className={selectCls} value={principalType} onChange={(e) => setPrincipalType(e.target.value as never)}>
                <option value="user">User</option><option value="department">Department</option><option value="role">Role</option>
              </select>
            </div>
            <div className="space-y-1"><Label>Level</Label>
              <select name="level" className={selectCls} defaultValue="VIEW">{['VIEW', 'COMMENT', 'EDIT', 'MANAGE'].map((l) => <option key={l} value={l}>{titleCase(l)}</option>)}</select>
            </div>
          </div>
          {principalType === 'user' && <select name="userId" className={selectCls} defaultValue="">{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}
          {principalType === 'department' && <select name="departmentId" className={selectCls} defaultValue="">{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>}
          {principalType === 'role' && <select name="role" className={selectCls} defaultValue="EMPLOYEE">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r as keyof typeof ROLE_LABELS]}</option>)}</select>}
          <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Grant access</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

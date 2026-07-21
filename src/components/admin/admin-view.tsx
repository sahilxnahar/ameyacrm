'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, KeyRound, Ban, CheckCircle2, ShieldCheck } from 'lucide-react';
import { createUser, setUserStatus, forcePasswordReset, createDepartment, setUserManager } from '@/server/actions/admin';
import { ROLE_LABELS } from '@/lib/rbac/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { titleCase } from '@/lib/utils/format';

const selectCls = 'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm';
const ROLES = ['SUPER_ADMIN','ADMIN','DEPARTMENT_HEAD','MANAGER','EXECUTIVE','EMPLOYEE','READ_ONLY','GUEST'];
interface U { id: string; name: string; username: string; email: string; role: string; status: string; department: string | null; twoFactor: boolean; managerId: string | null }
interface D { id: string; name: string; users: number; head: string | null; active: boolean }

export function AdminView({ users, departments, deptOptions }: { users: U[]; departments: D[]; deptOptions: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [userOpen, setUserOpen] = React.useState(false);
  const [deptOpen, setDeptOpen] = React.useState(false);

  const act = (fn: () => Promise<{ ok: true; id: string } | { error: string }>, ok: string) =>
    start(async () => { const r = await fn(); if ('error' in r) { toast.error(r.error); return; } toast.success(ok); router.refresh(); });

  const submitUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createUser({ name: fd.get('name'), username: fd.get('username'), email: fd.get('email'), phone: fd.get('phone'), employeeId: fd.get('employeeId'), designation: fd.get('designation'), role: fd.get('role'), departmentId: fd.get('departmentId') || null, password: fd.get('password') });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('User created'); setUserOpen(false); router.refresh();
    });
  };
  const submitDept = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createDepartment({ name: fd.get('name'), description: fd.get('description') });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Department created'); setDeptOpen(false); router.refresh();
    });
  };

  return (
    <Tabs defaultValue="users">
      <TabsList className="mb-4"><TabsTrigger value="users">Users</TabsTrigger><TabsTrigger value="departments">Departments</TabsTrigger><TabsTrigger value="roles">Roles</TabsTrigger></TabsList>

      <TabsContent value="users">
        <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => setUserOpen(true)}><Plus className="h-4 w-4" /> New user</Button></div>
        <Card><Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Department</TableHead><TableHead>Reports to</TableHead><TableHead>2FA</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell><p className="font-medium">{u.name}</p><p className="text-xs text-muted-foreground">@{u.username} · {u.email}</p></TableCell>
                <TableCell><Badge variant="secondary">{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.department ?? '—'}</TableCell>
                <TableCell>
                  <select
                    aria-label={`reportsTo-${u.id}`}
                    defaultValue={u.managerId ?? ''}
                    disabled={pending}
                    onChange={(e) => act(() => setUserManager(u.id, e.target.value || null), 'Reporting manager updated')}
                    className="h-8 max-w-[150px] rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="">—</option>
                    {users.filter((m2) => m2.id !== u.id).map((m2) => <option key={m2.id} value={m2.id}>{m2.name}</option>)}
                  </select>
                </TableCell>
                <TableCell>{u.twoFactor ? <ShieldCheck className="h-4 w-4 text-success" /> : <span className="text-xs text-muted-foreground">Off</span>}</TableCell>
                <TableCell><Badge variant={u.status === 'ACTIVE' ? 'success' : u.status === 'DISABLED' ? 'destructive' : 'warning'}>{titleCase(u.status)}</Badge></TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="sm">⋯</Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => act(() => forcePasswordReset(u.id), 'Password reset forced')}><KeyRound className="h-4 w-4" /> Force password reset</DropdownMenuItem>
                      {u.status === 'ACTIVE'
                        ? <DropdownMenuItem className="text-destructive" onClick={() => act(() => setUserStatus(u.id, 'DISABLED'), 'User disabled')}><Ban className="h-4 w-4" /> Disable</DropdownMenuItem>
                        : <DropdownMenuItem onClick={() => act(() => setUserStatus(u.id, 'ACTIVE'), 'User activated')}><CheckCircle2 className="h-4 w-4" /> Activate</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></Card>
      </TabsContent>

      <TabsContent value="departments">
        <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => setDeptOpen(true)}><Plus className="h-4 w-4" /> New department</Button></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <Card key={d.id} className="p-4"><p className="font-medium">{d.name}</p><p className="text-sm text-muted-foreground">{d.users} users · Head: {d.head ?? '—'}</p></Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="roles">
        <Card className="p-6 text-sm text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">Role-based access control</p>
          <p>Eight roles ship with sensible permission defaults ({ROLES.map((r) => ROLE_LABELS[r as keyof typeof ROLE_LABELS]).join(', ')}). Every permission is configurable per-role and per-user via the <code>RolePermission</code> / <code>UserPermission</code> tables. See <code>docs/RBAC_MATRIX.md</code> for the full grid.</p>
        </Card>
      </TabsContent>

      {/* New user */}
      <Dialog open={userOpen} onOpenChange={setUserOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>New user</DialogTitle><DialogDescription>They&apos;ll be required to change the password on first login.</DialogDescription></DialogHeader>
          <form onSubmit={submitUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" required /></div>
              <div className="space-y-2"><Label htmlFor="username">Username</Label><Input id="username" name="username" required /></div>
              <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
              <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" /></div>
              <div className="space-y-2"><Label htmlFor="employeeId">Employee ID</Label><Input id="employeeId" name="employeeId" /></div>
              <div className="space-y-2"><Label htmlFor="designation">Designation</Label><Input id="designation" name="designation" /></div>
              <div className="space-y-2"><Label htmlFor="role">Role</Label><select id="role" name="role" className={selectCls} defaultValue="EMPLOYEE">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r as keyof typeof ROLE_LABELS]}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="departmentId">Department</Label><select id="departmentId" name="departmentId" className={selectCls} defaultValue=""><option value="">—</option>{deptOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            </div>
            <div className="space-y-2"><Label htmlFor="password">Temporary password</Label><Input id="password" name="password" type="text" required placeholder="Min 8 characters" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setUserOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Create user</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* New department */}
      <Dialog open={deptOpen} onOpenChange={setDeptOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New department</DialogTitle></DialogHeader>
          <form onSubmit={submitDept} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="dname">Name</Label><Input id="dname" name="name" required autoFocus /></div>
            <div className="space-y-2"><Label htmlFor="description">Description</Label><Input id="description" name="description" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDeptOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Create</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

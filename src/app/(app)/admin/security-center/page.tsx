import type { Metadata } from 'next';
import { ShieldAlert, LogIn, Monitor, Lock, Download, HardDrive, Mail } from 'lucide-react';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ROLE_LABELS } from '@/lib/rbac/roles';
import { formatDateTime } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Security Center' };

export default async function SecurityCenterPage() {
  await requirePermission('admin.user.view');
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const now = new Date();
  const [failed7d, success7d, activeSessions, locked, no2fa, recentLogins, recentAudit] = await Promise.all([
    prisma.loginHistory.count({ where: { success: false, createdAt: { gt: weekAgo } } }),
    prisma.loginHistory.count({ where: { success: true, createdAt: { gt: weekAgo } } }),
    prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
    prisma.user.count({ where: { lockedUntil: { gt: now } } }),
    prisma.user.findMany({ where: { deletedAt: null, status: 'ACTIVE', twoFactorEnabled: false }, select: { id: true, name: true, email: true, role: true }, take: 100 }),
    prisma.loginHistory.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 25 }),
  ]);
  return (
    <div>
      <PageHeader title="Security center" description="Logins, sessions, 2FA coverage and the audit trail — at a glance.">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><a href="/api/admin/backup"><Download className="h-4 w-4" /> Download full backup (JSON)</a></Button>
          <Button asChild variant="outline" size="sm"><a href="/api/admin/storage-check" target="_blank" rel="noreferrer"><HardDrive className="h-4 w-4" /> Test file storage</a></Button>
          <Button asChild variant="outline" size="sm"><a href="/api/admin/drive-check" target="_blank" rel="noreferrer"><HardDrive className="h-4 w-4" /> Test Google Drive</a></Button>
          <Button asChild variant="outline" size="sm"><a href="/api/admin/email-check" target="_blank" rel="noreferrer"><Mail className="h-4 w-4" /> Test email (SMTP)</a></Button>
        </div>
      </PageHeader>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Failed logins (7d)" value={failed7d} icon={ShieldAlert} tone={failed7d > 0 ? 'warning' : undefined} />
        <StatCard label="Successful logins (7d)" value={success7d} icon={LogIn} />
        <StatCard label="Active sessions" value={activeSessions} icon={Monitor} />
        <StatCard label="Locked accounts" value={locked} icon={Lock} tone={locked > 0 ? 'destructive' : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold">Users without 2FA ({no2fa.length})</p>
          {no2fa.length === 0 ? <p className="text-sm text-muted-foreground">Everyone active has 2FA enabled. 🎉</p> : (
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {no2fa.map((u) => (
                <div key={u.id} className="flex items-center justify-between border-b py-1 text-sm last:border-0">
                  <span>{u.name} <span className="text-xs text-muted-foreground">· {u.email}</span></span>
                  <Badge variant="secondary">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold">Recent login activity</p>
          <div className="max-h-72 overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead>User</TableHead><TableHead>IP</TableHead><TableHead></TableHead><TableHead className="text-right">When</TableHead></TableRow></TableHeader>
              <TableBody>
                {recentLogins.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm">{l.username ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.ipAddress ?? '—'}</TableCell>
                    <TableCell><Badge variant={l.success ? 'success' : 'destructive'}>{l.success ? 'ok' : (l.reason ?? 'fail')}</Badge></TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{formatDateTime(l.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-4">
        <p className="mb-3 text-sm font-semibold">Audit trail (latest)</p>
        <div className="max-h-96 space-y-1 overflow-y-auto">
          {recentAudit.map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b py-1 text-sm last:border-0">
              <span><Badge variant="secondary" className="mr-2">{a.action}</Badge>{a.summary ?? a.entityType ?? '—'}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

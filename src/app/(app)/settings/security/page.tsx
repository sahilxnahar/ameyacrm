import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChangePassword } from '@/components/settings/change-password';
import { TwoFactorSetup } from '@/components/settings/two-factor-setup';
import { formatDateTime } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Security' };

export default async function SecurityPage() {
  const { user } = await requireAuth();
  const [sessions, logins] = await Promise.all([
    prisma.session.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastActiveAt: 'desc' }, take: 10 }),
    prisma.loginHistory.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Security & 2FA" description="Protect your account." />
      <ChangePassword />
      <TwoFactorSetup enabled={user.twoFactorEnabled} />

      <Card>
        <CardHeader><CardTitle className="text-lg">Active sessions</CardTitle><CardDescription>Devices currently signed in.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <span className="truncate text-muted-foreground">{s.userAgent?.slice(0, 60) ?? 'Unknown device'} · {s.ipAddress ?? '—'}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(s.lastActiveAt)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Recent login activity</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {logins.map((l) => (
            <div key={l.id} className="flex items-center justify-between py-1 text-sm">
              <span className="text-muted-foreground">{l.ipAddress ?? '—'} · {l.reason ?? ''}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {formatDateTime(l.createdAt)}
                <Badge variant={l.success ? 'success' : 'destructive'}>{l.success ? 'Success' : 'Failed'}</Badge>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

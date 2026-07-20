import type { Metadata } from 'next';
import { formatDistanceToNowStrict } from 'date-fns';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { PageHeader } from '@/components/layout/page-header';
import { MobileAppView } from '@/components/admin/mobile-app-view';

export const metadata: Metadata = { title: 'Mobile app & reminders' };
export const dynamic = 'force-dynamic';

export default async function MobileAppPage() {
  await requirePermission('admin.setting.manage');
  const [apkRow, notices, users, subs] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'app.apkUrl' } }),
    prisma.overdueNotice.findMany({ where: { resolvedAt: null }, orderBy: { dueAt: 'asc' }, take: 200 }),
    prisma.user.findMany({ where: { status: 'ACTIVE', deletedAt: null }, select: { id: true, name: true, whatsappNumber: true } }),
    prisma.pushSubscription.groupBy({ by: ['userId'], _count: { _all: true } }),
  ]);

  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const waOf = new Map(users.map((u) => [u.id, u.whatsappNumber]));
  const pushUsers = new Set(subs.map((s) => s.userId));

  return (
    <div>
      <PageHeader
        title="Mobile app & overdue reminders"
        description="The Android download link, and every piece of work currently past its date."
      />
      <MobileAppView
        apkUrl={(apkRow?.value as string) || ''}
        appUrl={env.APP_URL.replace(/\/$/, '')}
        pushEnabled={pushUsers.size}
        totalPeople={users.length}
        whatsappConfigured={Boolean(process.env.WHATSAPP_WEBHOOK_URL)}
        notices={notices.map((n) => ({
          id: n.id, title: n.title, kind: n.kind,
          userName: nameOf.get(n.userId) ?? '—',
          whatsappNumber: waOf.get(n.userId) ?? null,
          href: n.href,
          lateBy: formatDistanceToNowStrict(n.dueAt),
          pushCount: n.pushCount, emailCount: n.emailCount,
          hasPush: pushUsers.has(n.userId),
          snoozedUntil: n.snoozedUntil?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}

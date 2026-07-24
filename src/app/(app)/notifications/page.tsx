import type { Metadata } from 'next';
import Link from 'next/link';
import { Settings2 } from 'lucide-react';
import { requireAuth } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { InboxView, type InboxItem } from '@/components/notifications/inbox-view';

export const metadata: Metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const ctx = await requireAuth();
  try {
    const rows = await prisma.notification.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
    });
    const items: InboxItem[] = rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      read: n.readAt !== null,
      createdAt: n.createdAt.toISOString(),
    }));
    return (
      <div className="space-y-6">
        <PageHeader
          title="Notifications"
          description="Everything that needs your attention, in one place. Click any item to jump straight to it."
        >
          <Link href="/settings/notifications" className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-secondary">
            <Settings2 className="h-4 w-4" /> Preferences
          </Link>
        </PageHeader>
        <InboxView items={items} />
      </div>
    );
  } catch (e) {
    return <div className="space-y-6"><PageHeader title="Notifications" description="Everything that needs your attention." /><PageLoadError error={e} /></div>;
  }
}

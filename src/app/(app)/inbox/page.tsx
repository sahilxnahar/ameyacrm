import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { listThreads } from '@/server/services/inbox-service';
import { InboxView } from '@/components/inbox/inbox-view';

export const metadata: Metadata = { title: 'Shared Inbox' };
export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  await requirePermission('lead.view');
  const threads = await listThreads();
  return (
    <div className="space-y-6">
      <PageHeader title="Shared Inbox" description="Every email and WhatsApp conversation in one place — read what came in and reply, together as a team, without switching to Gmail or your phone." />
      <InboxView threads={threads} />
    </div>
  );
}

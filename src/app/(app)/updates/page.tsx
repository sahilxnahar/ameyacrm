import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { CHANGELOG } from '@/config/changelog';
import { UpdatesView } from '@/components/updates/updates-view';

export const metadata: Metadata = { title: "What's New" };
export const dynamic = 'force-dynamic';

export default async function UpdatesPage() {
  await requireAuth();
  return (
    <div className="space-y-6">
      <PageHeader
        title="What's New"
        description="Every feature and improvement we've added to Ameya Heights CRM, newest first. Search to find anything we've ever shipped."
      />
      <UpdatesView releases={CHANGELOG} />
    </div>
  );
}

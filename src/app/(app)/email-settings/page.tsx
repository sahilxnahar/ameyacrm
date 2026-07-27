import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { getUserImapStatus } from '@/server/services/user-imap-service';
import { EmailSettingsView } from '@/components/settings/email-settings-view';

export const metadata: Metadata = { title: 'Email Integration' };
export const dynamic = 'force-dynamic';

export default async function EmailSettingsPage() {
  const { user } = await requireAuth();
  const status = await getUserImapStatus(user.id);
  return (
    <div className="space-y-6">
      <PageHeader title="Email Integration" description="Connect your own email inbox over IMAP so your mail threads onto leads, buyers and vendors natively in the CRM — each person syncs their own mailbox, not a shared one." />
      <EmailSettingsView status={status} defaultEmail={user.email} />
    </div>
  );
}

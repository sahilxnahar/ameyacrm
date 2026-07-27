import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { GmailView } from '@/components/gmail/gmail-view';

export const metadata: Metadata = { title: 'Gmail' };
export const dynamic = 'force-dynamic';

export default async function GmailPage() {
  await requirePermission('email.send');
  return (
    <div className="space-y-6">
      <PageHeader
        title="Gmail"
        description="Your Gmail inbox over IMAP — read and reply without leaving the CRM. Sending uses your existing email setup."
      />
      <GmailView />
    </div>
  );
}

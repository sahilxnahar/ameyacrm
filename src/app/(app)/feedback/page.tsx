import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { FeedbackForm } from '@/components/feedback/feedback-form';

export const metadata: Metadata = { title: 'Send Feedback' };
export const dynamic = 'force-dynamic';

export default async function FeedbackPage() {
  await requireAuth();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Send Feedback"
        description="Your notes go straight to the team building this. Tell us what to fix, add or change."
      />
      <FeedbackForm />
    </div>
  );
}

import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { activeProvider } from '@/lib/ai/provider';
import { PageHeader } from '@/components/layout/page-header';
import { AssistantChat } from '@/components/assistant/assistant-chat';

export const metadata: Metadata = { title: 'Assistant' };
export const dynamic = 'force-dynamic';

export default async function AssistantPage() {
  await requireAuth();
  const provider = activeProvider();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Assistant"
        description="A helper for drafting messages, explaining terms, summarising, and thinking through next steps. It uses your configured AI provider and its backup keys."
      />
      <AssistantChat configured={provider.kind !== 'none'} />
    </div>
  );
}

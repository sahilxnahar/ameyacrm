import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { listConversations, userDirectory, getMessages, isMember } from '@/server/services/chat-service';
import { ChatView } from '@/components/chat/chat-view';

export const metadata: Metadata = { title: 'Messages' };
export const dynamic = 'force-dynamic';

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const ctx = await requireAuth();
  const me = ctx.user;
  const sp = await searchParams;
  const activeId = sp.c && (await isMember(sp.c, me.id)) ? sp.c : null;

  const [conversations, directory, activeMessages] = await Promise.all([
    listConversations(me.id),
    userDirectory(me.id),
    activeId ? getMessages(activeId, me.id) : Promise.resolve([]),
  ]);
  const activeTitle = activeId ? conversations.find((c) => c.id === activeId)?.title ?? 'Conversation' : null;

  return (
    <div className="space-y-4">
      <PageHeader title="Messages" description="Chat with anyone in the company by name or @username — no more internal emails to check a status. Tag people with @ to pull them in; they get notified." />
      <ChatView
        me={{ id: me.id, name: me.name, username: me.username }}
        conversations={conversations}
        directory={directory}
        activeId={activeId}
        activeTitle={activeTitle}
        activeMessages={activeMessages}
      />
    </div>
  );
}

'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { NotificationType } from '@prisma/client';
import {
  CheckSquare, MessageSquare, AtSign, Inbox as InboxIcon, CalendarClock, Calendar, FileText, Package, Megaphone, Bell, CheckCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { markNotificationRead, markAllNotificationsRead } from '@/server/actions/notifications';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils/cn';
import { timeAgo } from '@/lib/utils/format';

export interface InboxItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const ICON: Record<NotificationType, LucideIcon> = {
  TASK_ASSIGNED: CheckSquare,
  TASK_UPDATED: CheckSquare,
  COMMENT: MessageSquare,
  MENTION: AtSign,
  APPROVAL: InboxIcon,
  DEADLINE: CalendarClock,
  MEETING: Calendar,
  DOCUMENT: FileText,
  MATERIAL_REQUEST: Package,
  ANNOUNCEMENT: Megaphone,
  SYSTEM: Bell,
};

const LABEL: Record<NotificationType, string> = {
  TASK_ASSIGNED: 'Tasks', TASK_UPDATED: 'Tasks', COMMENT: 'Comments', MENTION: 'Mentions',
  APPROVAL: 'Approvals', DEADLINE: 'Deadlines', MEETING: 'Meetings', DOCUMENT: 'Documents',
  MATERIAL_REQUEST: 'Materials', ANNOUNCEMENT: 'Announcements', SYSTEM: 'System',
};

type Filter = 'all' | 'unread';

export function InboxView({ items: initial }: { items: InboxItem[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState<InboxItem[]>(initial);
  const [filter, setFilter] = React.useState<Filter>('all');
  const [typeFilter, setTypeFilter] = React.useState<NotificationType | 'ALL'>('ALL');

  React.useEffect(() => setItems(initial), [initial]);

  const unreadCount = items.filter((i) => !i.read).length;

  // The distinct types actually present, so the dropdown only offers real options.
  const presentTypes = React.useMemo(() => {
    const seen = new Set<NotificationType>();
    for (const i of items) seen.add(i.type);
    return [...seen];
  }, [items]);

  const shown = items.filter((i) => (filter === 'unread' ? !i.read : true) && (typeFilter === 'ALL' || i.type === typeFilter));

  const openItem = (item: InboxItem) => {
    if (!item.read) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      void markNotificationRead(item.id);
    }
    if (item.link) router.push(item.link);
  };

  const markAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    const r = await markAllNotificationsRead();
    if ('error' in r) toast.error(r.error);
    else { toast.success('All caught up'); router.refresh(); }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border p-0.5">
          <FilterTab active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterTab>
          <FilterTab active={filter === 'unread'} onClick={() => setFilter('unread')}>
            Unread{unreadCount > 0 && <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">{unreadCount}</span>}
          </FilterTab>
        </div>

        {presentTypes.length > 1 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as NotificationType | 'ALL')}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="ALL">All types</option>
            {presentTypes.map((t) => <option key={t} value={t}>{LABEL[t]}</option>)}
          </select>
        )}

        {unreadCount > 0 && (
          <button onClick={markAll} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-secondary">
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        )}
      </div>

      {/* List */}
      {shown.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === 'unread' ? "You're all caught up" : 'No notifications yet'}
          body={filter === 'unread' ? 'Nothing unread right now. Switch to “All” to see everything.' : "When something needs your attention, it'll show up here."}
        />
      ) : (
        <ul className="overflow-hidden rounded-lg border">
          {shown.map((item) => {
            const Icon = ICON[item.type] ?? Bell;
            return (
              <li key={item.id}>
                <button
                  onClick={() => openItem(item)}
                  className={cn(
                    'flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-secondary/50',
                    !item.read && 'bg-primary/[0.04]',
                  )}
                >
                  <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', item.read ? 'bg-secondary text-muted-foreground' : 'bg-primary/15 text-primary')}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      {!item.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      <span className={cn('truncate text-sm', !item.read && 'font-semibold')}>{item.title}</span>
                    </span>
                    {item.body && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.body}</span>}
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{LABEL[item.type]} · {timeAgo(item.createdAt)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn('inline-flex items-center rounded px-3 py-1 text-sm font-medium transition-colors', active ? 'bg-secondary' : 'text-muted-foreground hover:text-foreground')}
    >
      {children}
    </button>
  );
}

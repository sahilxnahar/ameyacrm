import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { NotificationPreferences } from '@/components/settings/notification-preferences';

export const metadata: Metadata = { title: 'Notification preferences' };

export default async function NotificationSettingsPage() {
  const { user } = await requireAuth();
  const [prefRows, settingRow] = await Promise.all([
    prisma.notificationPreference.findMany({ where: { userId: user.id } }),
    prisma.setting.findUnique({ where: { key: `notifications.${user.id}` } }),
  ]);
  const prefs: Record<string, boolean> = {};
  prefRows.forEach((r) => { prefs[`${r.type}:${r.channel}`] = r.enabled; });
  const sv = (settingRow?.value ?? {}) as Record<string, unknown>;
  const settings = {
    dnd: Boolean(sv.dnd), quietStart: (sv.quietStart as string) ?? '', quietEnd: (sv.quietEnd as string) ?? '',
    sound: sv.sound !== false, vibrate: sv.vibrate !== false,
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Notification preferences" description="Control what reaches you, where, and when." />
      <NotificationPreferences prefs={prefs} settings={settings} />
    </div>
  );
}

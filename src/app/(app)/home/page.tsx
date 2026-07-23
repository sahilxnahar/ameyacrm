import type { Metadata } from 'next';
import { startOfDay, endOfDay } from 'date-fns';
import { requireAuth } from '@/lib/auth/current-user';
import { getWorkItems } from '@/server/services/workload-service';
import { WelcomeHome } from '@/components/home/welcome-home';

export const metadata: Metadata = { title: 'Home' };
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const ctx = await requireAuth();
  const now = new Date();

  const items = await getWorkItems({ from: startOfDay(now), to: endOfDay(now), userIds: [ctx.user.id] })
    .catch(() => []);

  const agenda = items
    .slice(0, 12)
    .map((i) => ({ id: i.id, title: i.title, kind: i.kind, due: i.due, href: i.href }));

  const firstName = (ctx.user.name || '').trim().split(/\s+/)[0] || 'there';

  return <WelcomeHome firstName={firstName} agenda={agenda} />;
}

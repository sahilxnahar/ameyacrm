import type { Metadata } from 'next';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import { requireAuth } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { getWorkItems } from '@/server/services/workload-service';
import { todayAttendance } from '@/server/actions/field-ops';
import { WelcomeHome } from '@/components/home/welcome-home';

export const metadata: Metadata = { title: 'Home' };
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const ctx = await requireAuth();
  const now = new Date();

  const [items7, attendance, leadsToday] = await Promise.all([
    getWorkItems({ from: startOfDay(now), to: endOfDay(addDays(now, 7)), userIds: [ctx.user.id] }).catch(() => []),
    todayAttendance().catch(() => [] as Array<{ withinSite: boolean }>),
    prisma.lead.count({ where: { createdAt: { gte: startOfDay(now), lte: endOfDay(now) }, deletedAt: null } }).catch(() => 0),
  ]);

  const todayStr = now.toDateString();
  const isToday = (iso: string) => new Date(iso).toDateString() === todayStr;

  const agenda = items7
    .filter((i) => isToday(i.due))
    .slice(0, 12)
    .map((i) => ({ id: i.id, title: i.title, kind: i.kind, due: i.due, href: i.href }));

  const next7 = items7
    .filter((i) => !isToday(i.due))
    .slice(0, 10)
    .map((i) => ({ id: i.id, title: i.title, kind: i.kind, due: i.due, href: i.href }));

  const kpi = {
    leadsToday,
    tasksToday: items7.filter((i) => i.kind === 'TASK' && isToday(i.due)).length,
    approvals: items7.filter((i) => i.kind === 'APPROVAL').length,
    collectionsDue: Math.round(items7.filter((i) => i.kind === 'COLLECTION').reduce((s, i) => s + (i.amount ?? 0), 0)),
    followUps: items7.filter((i) => i.kind === 'REMINDER').length,
    onSite: attendance.filter((a) => a.withinSite).length,
  };

  const firstName = (ctx.user.name || '').trim().split(/\s+/)[0] || 'there';

  return <WelcomeHome firstName={firstName} agenda={agenda} next7={next7} kpi={kpi} />;
}

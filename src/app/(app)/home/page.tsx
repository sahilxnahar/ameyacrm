import type { Metadata } from 'next';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import { requireAuth } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { getWorkItems } from '@/server/services/workload-service';
import { todayAttendance } from '@/server/actions/field-ops';
import { getSecurityPolicy, mustEnroll2FA } from '@/lib/auth/policy';
import { ROLE_LABELS } from '@/lib/rbac/roles';
import { WelcomeHome } from '@/components/home/welcome-home';

export const metadata: Metadata = { title: 'Home' };
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const ctx = await requireAuth();
  const now = new Date();

  const [items7, attendance, leadsToday, policy, me] = await Promise.all([
    getWorkItems({ from: startOfDay(now), to: endOfDay(addDays(now, 7)), userIds: [ctx.user.id] }).catch(() => []),
    todayAttendance().catch(() => [] as Array<{ withinSite: boolean }>),
    prisma.lead.count({ where: { createdAt: { gte: startOfDay(now), lte: endOfDay(now) }, deletedAt: null } }).catch(() => 0),
    getSecurityPolicy().catch(() => null),
    prisma.user.findUnique({ where: { id: ctx.user.id }, select: { role: true, twoFactorEnabled: true, twoFactorGraceUntil: true } }).catch(() => null),
  ]);

  // A gentle, persistent reminder to set up 2FA — shown on home instead of
  // hijacking login with a forced detour to the security screen.
  const needs2FA = Boolean(policy && me && mustEnroll2FA(me, policy));

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

  const roleLabel = ROLE_LABELS[ctx.user.role] ?? '';

  return <WelcomeHome firstName={firstName} agenda={agenda} next7={next7} kpi={kpi} needs2FA={needs2FA} roleLabel={roleLabel} />;
}

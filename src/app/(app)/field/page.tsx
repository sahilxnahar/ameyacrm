import type { Metadata } from 'next';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { FieldView } from '@/components/field/field-view';

export const metadata: Metadata = { title: 'Site & attendance' };
export const dynamic = 'force-dynamic';

export default async function FieldPage() {
  const ctx = await requirePermission('dashboard.view');
  const isAdmin = can(ctx.permissions, 'admin.user.view');
  const now = new Date();

  const [projects, mine, todays, users, roster] = await Promise.all([
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true, latitude: true, longitude: true }, orderBy: { name: 'asc' } }),
    prisma.attendance.findMany({ where: { userId: ctx.user.id, at: { gte: startOfDay(now), lte: endOfDay(now) } }, orderBy: { at: 'desc' } }),
    isAdmin
      ? prisma.attendance.findMany({ where: { at: { gte: startOfDay(now), lte: endOfDay(now) } }, orderBy: { at: 'desc' }, take: 200 })
      : Promise.resolve([]),
    isAdmin
      ? prisma.user.findMany({ where: { status: 'ACTIVE', deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
      : Promise.resolve([]),
    prisma.dutyRoster.findMany({
      where: { date: { gte: startOfDay(now), lte: endOfDay(addDays(now, 13)) }, ...(isAdmin ? {} : { userId: ctx.user.id }) },
      orderBy: { date: 'asc' },
    }),
  ]);

  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  return (
    <div>
      <PageHeader
        title="Site & attendance"
        description="Check in from the site, see who is on duty, and plan the fortnight ahead. Works without signal."
      />
      <FieldView
        meId={ctx.user.id}
        isAdmin={isAdmin}
        projects={projects.map((p) => ({ id: p.id, name: p.name, hasCoords: p.latitude != null && p.longitude != null }))}
        myToday={mine.map((a) => ({ id: a.id, kind: a.kind, at: a.at.toISOString(), withinSite: a.withinSite, distanceM: a.distanceM, offline: a.offline }))}
        teamToday={todays.map((a) => ({
          id: a.id, userName: nameOf.get(a.userId) ?? '—', kind: a.kind,
          at: a.at.toISOString(), withinSite: a.withinSite, distanceM: a.distanceM, offline: a.offline,
        }))}
        users={users}
        roster={roster.map((r) => ({ id: r.id, userId: r.userId, userName: nameOf.get(r.userId) ?? 'You', date: r.date.toISOString(), shift: r.shift, note: r.note }))}
      />
    </div>
  );
}

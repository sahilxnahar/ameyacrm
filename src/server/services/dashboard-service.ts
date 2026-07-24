import 'server-only';
import { endOfDay, startOfDay, addDays } from 'date-fns';
import { prisma } from '@/lib/db/prisma';

/** Assemble every dashboard widget's data for a given user in one round-trip set. */
export async function getDashboardData(userId: string) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = addDays(now, 7);

  const [
    assignedOpen, dueToday, upcoming, completedThisWeek, pendingApprovals,
    recentDocuments, announcements, myRejected,
  ] = await Promise.all([
    prisma.taskAssignee.count({
      where: { userId, state: { notIn: ['COMPLETED', 'REJECTED'] }, task: { status: { notIn: ['DONE', 'CANCELLED'] }, deletedAt: null } },
    }),
    prisma.task.findMany({
      where: { deletedAt: null, dueDate: { gte: todayStart, lte: todayEnd }, assignees: { some: { userId } } },
      orderBy: { priority: 'desc' }, take: 6,
      select: { id: true, reference: true, title: true, priority: true, status: true, dueDate: true },
    }),
    prisma.task.findMany({
      where: { deletedAt: null, dueDate: { gt: todayEnd, lte: weekEnd }, status: { notIn: ['DONE', 'CANCELLED'] }, assignees: { some: { userId } } },
      orderBy: { dueDate: 'asc' }, take: 6,
      select: { id: true, reference: true, title: true, priority: true, dueDate: true },
    }),
    prisma.taskAssignee.count({
      where: { userId, state: 'COMPLETED', task: { completedAt: { gte: addDays(now, -7) } } },
    }),
    prisma.approvalStep.count({ where: { approverId: userId, status: 'PENDING' } }),
    prisma.document.findMany({
      where: { deletedAt: null }, orderBy: { updatedAt: 'desc' }, take: 5,
      select: { id: true, title: true, updatedAt: true, folder: { select: { name: true } } },
    }),
    prisma.announcement.findMany({
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }], take: 4,
      select: { id: true, title: true, body: true, createdAt: true, department: { select: { name: true } } },
    }),
    prisma.taskAssignee.count({ where: { userId, state: 'ASSIGNED' } }),
  ]);

  return {
    stats: { assignedOpen, dueTodayCount: dueToday.length, upcomingCount: upcoming.length, completedThisWeek, pendingApprovals, awaitingAcceptance: myRejected },
    dueToday, upcoming, recentDocuments, announcements,
  };
}

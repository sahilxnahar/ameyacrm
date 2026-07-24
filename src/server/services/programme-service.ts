import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { computeSchedule, earnedValue, type SchedActivity, type SchedDependency, type EvResult } from '@/lib/programme/schedule';

/**
 * The programme read model. The pure engine works in day-offsets; this maps
 * those back to calendar dates against a project start, and it derives the
 * "planned percent complete as of now" that earned value needs. Decimals become
 * numbers before anything crosses to the client.
 */

const num = (d: unknown): number => (d == null ? 0 : Number(d));
const DAY = 86_400_000;

export interface ScheduleRow {
  id: string;
  name: string;
  wbsCode: string | null;
  durationDays: number;
  percentComplete: number;
  plannedCost: number;
  actualCost: number;
  isMilestone: boolean;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  earlyStartDate: Date;
  earlyFinishDate: Date;
  totalFloat: number;
  critical: boolean;
}

export interface ProgrammeOverview {
  projectId: string | null;
  hasCycle: boolean;
  projectStart: Date;
  projectDurationDays: number;
  rows: ScheduleRow[];
  criticalCount: number;
  ev: EvResult;
  overallPercent: number;
  delays: Array<{ id: string; cause: string; responsibility: string; days: number; costImpact: number | null; activityName: string | null; occurredOn: Date | null }>;
  totalDelayDays: number;
  boq: Array<{ id: string; code: string | null; description: string; unit: string | null; quantity: number; rate: number; amount: number }>;
  boqTotal: number;
}

function plannedPercent(now: Date, start: Date | null, end: Date | null): number {
  if (!start || !end) return 0;
  const s = start.getTime(), e = end.getTime(), n = now.getTime();
  if (n <= s) return 0;
  if (n >= e || e <= s) return 100;
  return ((n - s) / (e - s)) * 100;
}

export async function programmeOverview(now: Date, projectId: string | null): Promise<ProgrammeOverview> {
  const activities = await prisma.programmeActivity.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const ids = new Set(activities.map((a) => a.id));
  const deps = await prisma.activityDependency.findMany({
    where: { predecessorId: { in: [...ids] } },
  });

  const schedActs: SchedActivity[] = activities.map((a) => ({ id: a.id, durationDays: Math.max(1, a.durationDays) }));
  const schedDeps: SchedDependency[] = deps
    .filter((d) => ids.has(d.predecessorId) && ids.has(d.successorId))
    .map((d) => ({ predecessorId: d.predecessorId, successorId: d.successorId, lagDays: d.lagDays }));
  const schedule = computeSchedule(schedActs, schedDeps);
  const schedById = new Map(schedule.activities.map((s) => [s.id, s]));

  // Project start: the earliest planned start, else the earliest activity created.
  const plannedStarts = activities.map((a) => a.plannedStart).filter((d): d is Date => d != null);
  const projectStart = plannedStarts.length
    ? new Date(Math.min(...plannedStarts.map((d) => d.getTime())))
    : (activities[0]?.createdAt ?? now);

  const rows: ScheduleRow[] = activities.map((a) => {
    const s = schedById.get(a.id);
    const es = s?.earlyStart ?? 0;
    const ef = s?.earlyFinish ?? Math.max(1, a.durationDays);
    return {
      id: a.id, name: a.name, wbsCode: a.wbsCode, durationDays: a.durationDays,
      percentComplete: num(a.percentComplete), plannedCost: num(a.plannedCost), actualCost: num(a.actualCost),
      isMilestone: a.isMilestone, plannedStart: a.plannedStart, plannedEnd: a.plannedEnd,
      earlyStartDate: new Date(projectStart.getTime() + es * DAY),
      earlyFinishDate: new Date(projectStart.getTime() + ef * DAY),
      totalFloat: s?.totalFloat ?? 0,
      critical: s?.critical ?? false,
    };
  });

  const ev = earnedValue(activities.map((a) => ({
    plannedCost: num(a.plannedCost),
    percentComplete: num(a.percentComplete),
    actualCost: num(a.actualCost),
    plannedPercent: plannedPercent(now, a.plannedStart, a.plannedEnd),
  })));

  const totalPlannedCost = activities.reduce((s, a) => s + num(a.plannedCost), 0);
  const overallPercent = totalPlannedCost > 0
    ? Math.round((ev.earnedValue / totalPlannedCost) * 100)
    : (activities.length ? Math.round(activities.reduce((s, a) => s + num(a.percentComplete), 0) / activities.length) : 0);

  const delayRows = await prisma.delayEntry.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { activity: { select: { name: true } } },
  });
  const boqRows = await prisma.boqItem.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return {
    projectId,
    hasCycle: schedule.hasCycle,
    projectStart,
    projectDurationDays: schedule.projectDuration,
    rows,
    criticalCount: schedule.criticalPath.length,
    ev,
    overallPercent,
    delays: delayRows.map((d) => ({
      id: d.id, cause: d.cause, responsibility: d.responsibility, days: d.days,
      costImpact: d.costImpact == null ? null : num(d.costImpact),
      activityName: d.activity?.name ?? null, occurredOn: d.occurredOn,
    })),
    totalDelayDays: delayRows.reduce((s, d) => s + d.days, 0),
    boq: boqRows.map((b) => ({ id: b.id, code: b.code, description: b.description, unit: b.unit, quantity: num(b.quantity), rate: num(b.rate), amount: num(b.amount) })),
    boqTotal: boqRows.reduce((s, b) => s + num(b.amount), 0),
  };
}

export interface ActivityOption { id: string; name: string }
export async function activityOptions(projectId: string | null): Promise<ActivityOption[]> {
  const acts = await prisma.programmeActivity.findMany({
    where: projectId ? { projectId } : undefined,
    select: { id: true, name: true },
    orderBy: { sortOrder: 'asc' },
  });
  return acts;
}

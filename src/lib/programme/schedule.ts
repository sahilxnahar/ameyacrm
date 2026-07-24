/**
 * Critical-path scheduling and earned value, kept pure so the hard part can be
 * tested without a database.
 *
 * A programme is what makes "late" mean something. The forward and backward
 * passes compute, for every activity, the earliest and latest it can start and
 * finish; the difference is its float, and the activities with none are the
 * critical path — the chain where a day lost is a day lost off the whole project.
 *
 * Everything is in integer day-offsets from an abstract project start (day 0),
 * so no dates are constructed here and the timezone bug from the handover cannot
 * happen. The caller maps day-offsets back to calendar dates.
 */

export interface SchedActivity {
  id: string;
  durationDays: number;
}

/** A finish-to-start link: `successor` cannot start until `predecessor` finishes
 *  (plus `lagDays`). Other link types are stored but scheduled as FS for now. */
export interface SchedDependency {
  predecessorId: string;
  successorId: string;
  lagDays?: number;
}

export interface ScheduledActivity {
  id: string;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  totalFloat: number;
  critical: boolean;
}

export interface ScheduleResult {
  activities: ScheduledActivity[];
  projectDuration: number;
  /** True if the dependencies contain a cycle; when so, the schedule is empty
   *  rather than wrong. A cycle is a data error a person must fix. */
  hasCycle: boolean;
  /** Ids on the critical path, in topological order. */
  criticalPath: string[];
}

/**
 * Compute the schedule by CPM.
 *
 * Kahn's algorithm gives a topological order and detects a cycle in one pass.
 * The forward pass sets early start/finish; the backward pass, walked in
 * reverse, sets late start/finish. Float is late-start minus early-start, and an
 * activity with zero float is critical.
 */
export function computeSchedule(activities: SchedActivity[], dependencies: SchedDependency[]): ScheduleResult {
  const byId = new Map(activities.map((a) => [a.id, a]));
  // Keep only links whose endpoints both exist.
  const deps = dependencies.filter((d) => byId.has(d.predecessorId) && byId.has(d.successorId));

  const preds = new Map<string, Array<{ id: string; lag: number }>>();
  const succs = new Map<string, Array<{ id: string; lag: number }>>();
  const indegree = new Map<string, number>();
  for (const a of activities) { preds.set(a.id, []); succs.set(a.id, []); indegree.set(a.id, 0); }
  for (const d of deps) {
    const lag = d.lagDays ?? 0;
    succs.get(d.predecessorId)!.push({ id: d.successorId, lag });
    preds.get(d.successorId)!.push({ id: d.predecessorId, lag });
    indegree.set(d.successorId, (indegree.get(d.successorId) ?? 0) + 1);
  }

  // Topological order (Kahn). Deterministic: process ready nodes in input order.
  const order: string[] = [];
  const ready = activities.filter((a) => (indegree.get(a.id) ?? 0) === 0).map((a) => a.id);
  const indeg = new Map(indegree);
  while (ready.length) {
    const id = ready.shift()!;
    order.push(id);
    for (const s of succs.get(id)!) {
      indeg.set(s.id, indeg.get(s.id)! - 1);
      if (indeg.get(s.id) === 0) ready.push(s.id);
    }
  }
  if (order.length !== activities.length) {
    return { activities: [], projectDuration: 0, hasCycle: true, criticalPath: [] };
  }

  // Forward pass
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of order) {
    const dur = byId.get(id)!.durationDays;
    const start = preds.get(id)!.reduce((m, p) => Math.max(m, ef.get(p.id)! + p.lag), 0);
    es.set(id, start);
    ef.set(id, start + dur);
  }
  const projectDuration = Math.max(0, ...order.map((id) => ef.get(id)!));

  // Backward pass
  const lf = new Map<string, number>();
  const ls = new Map<string, number>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]!;
    const dur = byId.get(id)!.durationDays;
    const finish = succs.get(id)!.length === 0
      ? projectDuration
      : succs.get(id)!.reduce((m, s) => Math.min(m, ls.get(s.id)! - s.lag), Infinity);
    lf.set(id, finish);
    ls.set(id, finish - dur);
  }

  const scheduled: ScheduledActivity[] = order.map((id) => {
    const totalFloat = ls.get(id)! - es.get(id)!;
    return {
      id,
      earlyStart: es.get(id)!,
      earlyFinish: ef.get(id)!,
      lateStart: ls.get(id)!,
      lateFinish: lf.get(id)!,
      totalFloat,
      critical: totalFloat === 0,
    };
  });

  return {
    activities: scheduled,
    projectDuration,
    hasCycle: false,
    criticalPath: scheduled.filter((a) => a.critical).map((a) => a.id),
  };
}

// ── Earned value ─────────────────────────────────────────────────────────────

export interface EvInput {
  /** Budgeted cost of the activity (its planned cost). */
  plannedCost: number;
  /** 0–100. */
  percentComplete: number;
  /** What has actually been spent on it. */
  actualCost: number;
  /** The share of plannedCost that *should* be earned by now, 0–100. Defaults to
   *  100 when the activity's planned window has fully elapsed; the caller decides. */
  plannedPercent: number;
}

export interface EvResult {
  budgetAtCompletion: number;
  plannedValue: number;
  earnedValue: number;
  actualCost: number;
  /** Earned − planned. Negative means behind schedule (in money terms). */
  scheduleVariance: number;
  /** Earned − actual. Negative means over cost. */
  costVariance: number;
  /** Earned ÷ planned. Below 1 is behind schedule. */
  schedulePerformanceIndex: number;
  /** Earned ÷ actual. Below 1 is over cost. */
  costPerformanceIndex: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Roll a set of activities up into the earned-value metrics. */
export function earnedValue(items: EvInput[]): EvResult {
  let bac = 0, pv = 0, ev = 0, ac = 0;
  for (const it of items) {
    bac += it.plannedCost;
    pv += it.plannedCost * (Math.min(100, Math.max(0, it.plannedPercent)) / 100);
    ev += it.plannedCost * (Math.min(100, Math.max(0, it.percentComplete)) / 100);
    ac += it.actualCost;
  }
  return {
    budgetAtCompletion: r2(bac),
    plannedValue: r2(pv),
    earnedValue: r2(ev),
    actualCost: r2(ac),
    scheduleVariance: r2(ev - pv),
    costVariance: r2(ev - ac),
    schedulePerformanceIndex: pv > 0 ? r2(ev / pv) : 0,
    costPerformanceIndex: ac > 0 ? r2(ev / ac) : 0,
  };
}

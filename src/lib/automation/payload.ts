/**
 * What an automation gets to look at when it fires.
 *
 * There is one job here: make sure the fields a rule may test are the fields
 * the engine is actually handed. They had drifted apart — three shipped rules
 * tested `budgetMax`, `lostReason` and `isNri` while the payload carried none
 * of them, so those rules could never once have matched. Nothing failed; they
 * simply never fired, which is the failure mode that survives longest.
 */

export interface LeadLike {
  name: string; email: string | null; phone: string | null;
  source: string | null; status: string; score: number;
  isNri: boolean; country: string | null; locality: string | null;
  budgetMin: unknown; budgetMax: unknown;
  lostReason: string | null; ownerId: string | null; projectId: string | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function leadPayload(lead: LeadLike, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    status: lead.status,
    score: lead.score,
    isNri: lead.isNri,
    country: lead.country,
    locality: lead.locality,
    // Decimal comes back from Prisma as an object; comparisons need a number.
    budgetMin: num(lead.budgetMin),
    budgetMax: num(lead.budgetMax),
    lostReason: lead.lostReason,
    ownerId: lead.ownerId,
    projectId: lead.projectId,
    ...extra,
  };
}

export interface TaskLike {
  title: string; priority: string; status: string;
  departmentId?: string | null; projectId?: string | null; createdById?: string | null;
}

export function taskPayload(task: TaskLike, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: task.title,
    priority: task.priority,
    status: task.status,
    departmentId: task.departmentId ?? null,
    projectId: task.projectId ?? null,
    createdById: task.createdById ?? null,
    ...extra,
  };
}

/** The single source of truth for which fields exist, per trigger. */
export const PAYLOAD_FIELDS = {
  LEAD_CREATED: ['name', 'email', 'phone', 'source', 'status', 'score', 'isNri', 'country', 'locality', 'budgetMin', 'budgetMax', 'lostReason', 'ownerId', 'projectId'],
  LEAD_STAGE_CHANGED: ['name', 'email', 'phone', 'source', 'status', 'previousStatus', 'score', 'isNri', 'country', 'locality', 'budgetMin', 'budgetMax', 'lostReason', 'ownerId', 'projectId'],
  TASK_CREATED: ['title', 'priority', 'status', 'departmentId', 'projectId', 'createdById'],
  TASK_STATUS_CHANGED: ['title', 'priority', 'status', 'previousStatus', 'departmentId', 'projectId', 'createdById'],
  SCHEDULE: [],
} as const;

import 'server-only';
import { prisma } from '@/lib/db/prisma';

/** The department(s) a person belongs to — their main one plus any extras. */
export async function userDeptIds(userId: string): Promise<string[]> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true, extraDepartments: { select: { departmentId: true } } } });
  const ids = [u?.departmentId, ...(u?.extraDepartments.map((e) => e.departmentId) ?? [])].filter((x): x is string => Boolean(x));
  return [...new Set(ids)];
}

export interface WorkRequestRow {
  id: string;
  reference: string;
  title: string;
  priority: string;
  status: string;
  fromDept: string | null;
  toDept: string | null;
  raisedBy: string | null;
  owner: string | null;
  dueOn: Date | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
}

async function deptNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const real = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (real.length === 0) return new Map();
  const rows = await prisma.department.findMany({ where: { id: { in: real } }, select: { id: true, name: true } });
  return new Map(rows.map((r) => [r.id, r.name]));
}

async function userNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const real = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (real.length === 0) return new Map();
  const rows = await prisma.user.findMany({ where: { id: { in: real } }, select: { id: true, name: true } });
  return new Map(rows.map((r) => [r.id, r.name]));
}

function toRows(
  raw: Array<{ id: string; reference: string; title: string; priority: string; status: string; fromDeptId: string | null; toDeptId: string | null; raisedById: string | null; ownerId: string | null; dueOn: Date | null; entityType: string | null; entityId: string | null; createdAt: Date }>,
  depts: Map<string, string>,
  users: Map<string, string>,
): WorkRequestRow[] {
  return raw.map((r) => ({
    id: r.id, reference: r.reference, title: r.title, priority: r.priority, status: r.status,
    fromDept: r.fromDeptId ? depts.get(r.fromDeptId) ?? null : null,
    toDept: r.toDeptId ? depts.get(r.toDeptId) ?? null : null,
    raisedBy: r.raisedById ? users.get(r.raisedById) ?? null : null,
    owner: r.ownerId ? users.get(r.ownerId) ?? null : null,
    dueOn: r.dueOn, entityType: r.entityType, entityId: r.entityId, createdAt: r.createdAt,
  }));
}

export interface WorkRequestInbox {
  incoming: WorkRequestRow[];
  outgoing: WorkRequestRow[];
  openIncoming: number;
}

/** Requests to this person's department(s), and requests they or their department raised. */
export async function getWorkRequestInbox(userId: string, deptIds: string[]): Promise<WorkRequestInbox> {
  const [incoming, outgoing] = await Promise.all([
    prisma.workRequest.findMany({ where: { toDeptId: { in: deptIds.length ? deptIds : ['—none—'] } }, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 500 }),
    prisma.workRequest.findMany({ where: { OR: [{ raisedById: userId }, { fromDeptId: { in: deptIds.length ? deptIds : ['—none—'] } }] }, orderBy: { createdAt: 'desc' }, take: 500 }),
  ]);
  const all = [...incoming, ...outgoing];
  const [depts, users] = await Promise.all([
    deptNames(all.flatMap((r) => [r.fromDeptId, r.toDeptId])),
    userNames(all.flatMap((r) => [r.raisedById, r.ownerId])),
  ]);
  const openIncoming = incoming.filter((r) => !['CONFIRMED', 'REJECTED'].includes(r.status)).length;
  return { incoming: toRows(incoming, depts, users), outgoing: toRows(outgoing, depts, users), openIncoming };
}

export interface WorkRequestDetail extends WorkRequestRow {
  detail: string | null;
  linkedTaskId: string | null;
  events: Array<{ id: string; actor: string | null; fromStatus: string | null; toStatus: string; note: string | null; createdAt: Date }>;
  comments: Array<{ id: string; author: string | null; body: string; createdAt: Date }>;
}

export async function getWorkRequest(id: string): Promise<WorkRequestDetail | null> {
  const r = await prisma.workRequest.findUnique({ where: { id }, include: { events: { orderBy: { createdAt: 'asc' } }, comments: { orderBy: { createdAt: 'asc' } } } });
  if (!r) return null;
  const [depts, users] = await Promise.all([
    deptNames([r.fromDeptId, r.toDeptId]),
    userNames([r.raisedById, r.ownerId, ...r.events.map((e) => e.actorId), ...r.comments.map((c) => c.authorId)]),
  ]);
  const [base] = toRows([r], depts, users);
  return {
    ...base!,
    detail: r.detail,
    linkedTaskId: r.linkedTaskId,
    events: r.events.map((e) => ({ id: e.id, actor: e.actorId ? users.get(e.actorId) ?? null : null, fromStatus: e.fromStatus, toStatus: e.toStatus, note: e.note, createdAt: e.createdAt })),
    comments: r.comments.map((c) => ({ id: c.id, author: c.authorId ? users.get(c.authorId) ?? null : null, body: c.body, createdAt: c.createdAt })),
  };
}

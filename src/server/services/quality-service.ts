import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { holdPointState, summariseSafety, permitIsExpired, type SafetyInput } from '@/lib/quality/holdpoints';

const num = (d: unknown): number | null => (d == null ? null : Number(d));

export interface InspectionRow {
  id: string; title: string; discipline: string | null; isHoldPoint: boolean;
  status: string; inspectedBy: string | null; inspectedOn: Date | null; activityId: string | null;
  itemCount: number; passedItems: number;
}
export interface NcrRow {
  id: string; title: string; severity: string; status: string; assignedTo: string | null;
  costImpact: number | null; raisedOn: Date; closedOn: Date | null;
}
export interface PermitRow {
  id: string; type: string; status: string; issuedTo: string; location: string | null;
  validFrom: Date | null; validTo: Date | null; expired: boolean;
}
export interface SafetyRow {
  id: string; kind: string; severity: string; description: string; rootCause: string | null;
  personsAffected: number; occurredOn: Date;
}

export interface QualityOverview {
  inspections: InspectionRow[];
  ncrs: NcrRow[];
  permits: PermitRow[];
  safety: SafetyRow[];
  safetySummary: ReturnType<typeof summariseSafety>;
  openHoldPoints: number;
  failedHoldPoints: number;
  openNcrs: number;
  openPermits: number;
  expiredPermits: number;
}

export async function qualityOverview(now: Date, projectId: string | null): Promise<QualityOverview> {
  const where = projectId ? { projectId } : {};
  const [inspections, ncrs, permits, safety] = await Promise.all([
    prisma.inspection.findMany({ where, orderBy: { createdAt: 'desc' }, include: { items: { select: { passed: true } } } }),
    prisma.nonConformance.findMany({ where, orderBy: [{ status: 'asc' }, { raisedOn: 'desc' }] }),
    prisma.workPermit.findMany({ where, orderBy: [{ status: 'asc' }, { validTo: 'asc' }] }),
    prisma.safetyRecord.findMany({ where, orderBy: { occurredOn: 'desc' }, take: 500 }),
  ]);

  const inspectionRows: InspectionRow[] = inspections.map((i) => ({
    id: i.id, title: i.title, discipline: i.discipline, isHoldPoint: i.isHoldPoint,
    status: i.status, inspectedBy: i.inspectedBy, inspectedOn: i.inspectedOn, activityId: i.activityId,
    itemCount: i.items.length, passedItems: i.items.filter((it) => it.passed).length,
  }));

  const hp = holdPointState(inspections.map((i) => ({ id: i.id, isHoldPoint: i.isHoldPoint, status: i.status })));

  const permitRows: PermitRow[] = permits.map((p) => ({
    id: p.id, type: p.type, status: p.status, issuedTo: p.issuedTo, location: p.location,
    validFrom: p.validFrom, validTo: p.validTo,
    expired: permitIsExpired({ id: p.id, status: p.status, validTo: p.validTo }, now),
  }));

  const safetyInputs: SafetyInput[] = safety.map((s) => ({ kind: s.kind, occurredOn: s.occurredOn }));

  return {
    inspections: inspectionRows,
    ncrs: ncrs.map((n) => ({ id: n.id, title: n.title, severity: n.severity, status: n.status, assignedTo: n.assignedTo, costImpact: num(n.costImpact), raisedOn: n.raisedOn, closedOn: n.closedOn })),
    permits: permitRows,
    safety: safety.map((s) => ({ id: s.id, kind: s.kind, severity: s.severity, description: s.description, rootCause: s.rootCause, personsAffected: s.personsAffected, occurredOn: s.occurredOn })),
    safetySummary: summariseSafety(safetyInputs, now),
    openHoldPoints: hp.openHoldPoints,
    failedHoldPoints: hp.failedHoldPoints,
    openNcrs: ncrs.filter((n) => n.status !== 'CLOSED').length,
    openPermits: permits.filter((p) => p.status === 'OPEN').length,
    expiredPermits: permitRows.filter((p) => p.expired).length,
  };
}

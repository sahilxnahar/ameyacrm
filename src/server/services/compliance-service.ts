import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { threeWayMatch, type MatchStatus } from '@/lib/procurement/three-way';
import { riskScore, type RiskBand } from '@/lib/governance/risk';

const numN = (d: unknown): number | null => (d == null ? null : Number(d));
const num = (d: unknown): number => (d == null ? 0 : Number(d));

// Batch 3 — statutory calendar
export interface ObligationRow { id: string; title: string; kind: string; authority: string | null; frequency: string; owner: string | null; nextDue: Date | null; lastFiled: Date | null; status: string; }
export async function obligations(projectId: string | null): Promise<ObligationRow[]> {
  const rows = await prisma.statutoryObligation.findMany({ where: projectId ? { projectId } : undefined, orderBy: [{ status: 'asc' }, { nextDue: 'asc' }] });
  return rows.map((o) => ({ id: o.id, title: o.title, kind: o.kind, authority: o.authority, frequency: o.frequency, owner: o.owner, nextDue: o.nextDue, lastFiled: o.lastFiled, status: o.status }));
}

// Batch 6 — goods received with three-way match
export interface GrnRow { id: string; vendorName: string; materialName: string; poReference: string | null; unit: string | null; orderedQty: number; receivedQty: number; billedQty: number; matchStatus: MatchStatus; matchDetail: string; clean: boolean; receivedOn: Date; }
export async function goodsReceipts(projectId: string | null): Promise<GrnRow[]> {
  const rows = await prisma.goodsReceipt.findMany({ where: projectId ? { projectId } : undefined, orderBy: { receivedOn: 'desc' }, take: 1000 });
  return rows.map((g) => {
    const m = threeWayMatch(num(g.orderedQty), num(g.receivedQty), num(g.billedQty));
    return { id: g.id, vendorName: g.vendorName, materialName: g.materialName, poReference: g.poReference, unit: g.unit, orderedQty: num(g.orderedQty), receivedQty: num(g.receivedQty), billedQty: num(g.billedQty), matchStatus: m.status, matchDetail: m.detail, clean: m.clean, receivedOn: g.receivedOn };
  });
}

// Batch 22 — risk register
export interface RiskRow { id: string; title: string; category: string | null; likelihood: string; impact: string; owner: string | null; status: string; score: number; band: RiskBand; }
export async function risks(projectId: string | null): Promise<RiskRow[]> {
  const rows = await prisma.riskEntry.findMany({ where: projectId ? { projectId } : undefined, orderBy: { createdAt: 'desc' } });
  return rows.map((r) => { const s = riskScore(r.likelihood as never, r.impact as never); return { id: r.id, title: r.title, category: r.category, likelihood: r.likelihood, impact: r.impact, owner: r.owner, status: r.status, score: s.score, band: s.band }; })
    .sort((a, b) => b.score - a.score);
}

// Batch 25 — security incidents
export interface IncidentRow { id: string; title: string; severity: string; kind: string | null; detectedOn: Date; status: string; }
export async function incidents(): Promise<IncidentRow[]> {
  const rows = await prisma.securityIncident.findMany({ orderBy: [{ status: 'asc' }, { detectedOn: 'desc' }], take: 1000 });
  return rows.map((i) => ({ id: i.id, title: i.title, severity: i.severity, kind: i.kind, detectedOn: i.detectedOn, status: i.status }));
}

// Batch 29 — decision log
export interface DecisionRow { id: string; title: string; decidedOn: Date; decidedBy: string | null; decision: string; context: string | null; }
export async function decisions(projectId: string | null): Promise<DecisionRow[]> {
  const rows = await prisma.decisionLog.findMany({ where: projectId ? { projectId } : undefined, orderBy: { decidedOn: 'desc' }, take: 1000 });
  return rows.map((d) => ({ id: d.id, title: d.title, decidedOn: d.decidedOn, decidedBy: d.decidedBy, decision: d.decision, context: d.context }));
}

// Batch 23 — environmental clearance conditions
export interface EnvRow { id: string; condition: string; authority: string | null; status: string; dueOn: Date | null; evidence: string | null; }
export async function envConditions(projectId: string | null): Promise<EnvRow[]> {
  const rows = await prisma.envClearanceCondition.findMany({ where: projectId ? { projectId } : undefined, orderBy: [{ status: 'asc' }, { dueOn: 'asc' }] });
  return rows.map((e) => ({ id: e.id, condition: e.condition, authority: e.authority, status: e.status, dueOn: e.dueOn, evidence: e.evidence }));
}

export { numN };

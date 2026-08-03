import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { threeWayMatch, type MatchStatus } from '@/lib/procurement/three-way';
import { riskScore, type RiskBand } from '@/lib/governance/risk';

const numN = (d: unknown): number | null => (d == null ? null : Number(d));
const num = (d: unknown): number => (d == null ? 0 : Number(d));

// Batch 3 — statutory calendar
export interface ObligationRow { id: string; title: string; kind: string; authority: string | null; frequency: string; owner: string | null; nextDue: Date | null; lastFiled: Date | null; status: string; }
export async function obligations(projectId: string | null): Promise<ObligationRow[]> {
  const rows = await prisma.statutoryObligation.findMany({ where: projectId ? { projectId } : undefined, orderBy: [{ status: 'asc' }, { nextDue: 'asc' }], take: 1000 });
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
  const rows = await prisma.riskEntry.findMany({ where: projectId ? { projectId } : undefined, orderBy: { createdAt: 'desc' }, take: 1000 });
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
  const rows = await prisma.envClearanceCondition.findMany({ where: projectId ? { projectId } : undefined, orderBy: [{ status: 'asc' }, { dueOn: 'asc' }], take: 1000 });
  return rows.map((e) => ({ id: e.id, condition: e.condition, authority: e.authority, status: e.status, dueOn: e.dueOn, evidence: e.evidence }));
}

export { numN };

// ─── The nine registers that had tables and no screens ───────────────────────
//
// These models shipped with the migrations and nothing ever read or wrote them,
// while four menu descriptions advertised them. Each one is a real register a
// developer keeps somewhere — usually a spreadsheet on somebody's laptop — so
// the fix is to build them rather than to quietly drop the promise.

const D = (v: Date | null | undefined): Date | null => v ?? null;

export interface ContractRow { id: string; title: string; counterparty: string; kind: string | null; value: number | null; startsOn: Date | null; endsOn: Date | null; renewalOn: Date | null; status: string }
export async function contracts(projectId: string | null): Promise<ContractRow[]> {
  const rows = await prisma.contractRecord.findMany({ where: projectId ? { projectId } : undefined, orderBy: [{ status: 'asc' }, { renewalOn: 'asc' }], take: 1000 });
  return rows.map((c) => ({ id: c.id, title: c.title, counterparty: c.counterparty, kind: c.kind, value: numN(c.value), startsOn: D(c.startsOn), endsOn: D(c.endsOn), renewalOn: D(c.renewalOn), status: c.status }));
}

export interface PolicyRow { id: string; name: string; insurer: string; policyNo: string | null; cover: number | null; premium: number | null; expiresOn: Date | null }
export async function insurancePolicies(projectId: string | null): Promise<PolicyRow[]> {
  const rows = await prisma.insurancePolicy.findMany({ where: projectId ? { projectId } : undefined, orderBy: { expiresOn: 'asc' }, take: 1000 });
  return rows.map((p) => ({ id: p.id, name: p.name, insurer: p.insurer, policyNo: p.policyNo, cover: numN(p.cover), premium: numN(p.premium), expiresOn: D(p.expiresOn) }));
}

export interface SopRow { id: string; title: string; department: string | null; version: number; status: string; effectiveOn: Date | null }
export async function sops(): Promise<SopRow[]> {
  const rows = await prisma.sop.findMany({ orderBy: [{ status: 'asc' }, { title: 'asc' }], take: 1000 });
  return rows.map((s) => ({ id: s.id, title: s.title, department: s.department, version: s.version, status: s.status, effectiveOn: D(s.effectiveOn) }));
}

export interface LessonRow { id: string; title: string; category: string | null; situation: string | null; recommendation: string; capturedOn: Date }
export async function lessons(projectId: string | null): Promise<LessonRow[]> {
  const rows = await prisma.lessonLearned.findMany({ where: projectId ? { projectId } : undefined, orderBy: { capturedOn: 'desc' }, take: 1000 });
  return rows.map((l) => ({ id: l.id, title: l.title, category: l.category, situation: l.situation, recommendation: l.recommendation, capturedOn: l.capturedOn }));
}

export interface ManifestRow { id: string; manifestNo: string | null; wasteType: string; quantity: number; unit: string | null; disposedTo: string | null; disposedOn: Date | null }
export async function wasteManifests(projectId: string | null): Promise<ManifestRow[]> {
  const rows = await prisma.wasteManifest.findMany({ where: projectId ? { projectId } : undefined, orderBy: { disposedOn: 'desc' }, take: 1000 });
  return rows.map((w) => ({ id: w.id, manifestNo: w.manifestNo, wasteType: w.wasteType, quantity: num(w.quantity), unit: w.unit, disposedTo: w.disposedTo, disposedOn: D(w.disposedOn) }));
}

export interface AccessReviewRow { id: string; subject: string; scope: string | null; reviewer: string | null; dueOn: Date | null; completedOn: Date | null; findings: string | null }
export async function accessReviews(): Promise<AccessReviewRow[]> {
  const rows = await prisma.accessReview.findMany({ orderBy: [{ completedOn: 'asc' }, { dueOn: 'asc' }], take: 1000 });
  return rows.map((a) => ({ id: a.id, subject: a.subject, scope: a.scope, reviewer: a.reviewer, dueOn: D(a.dueOn), completedOn: D(a.completedOn), findings: a.findings }));
}

export interface RenewalRow { id: string; title: string; category: string | null; reference: string | null; expiresOn: Date | null; owner: string | null; renewed: boolean }
export async function licenceRenewals(projectId: string | null): Promise<RenewalRow[]> {
  const rows = await prisma.complianceDocExpiry.findMany({ where: projectId ? { projectId } : undefined, orderBy: [{ renewed: 'asc' }, { expiresOn: 'asc' }], take: 1000 });
  return rows.map((c) => ({ id: c.id, title: c.title, category: c.category, reference: c.reference, expiresOn: D(c.expiresOn), owner: c.owner, renewed: c.renewed }));
}

export interface PoaRow { id: string; grantor: string; attorney: string; scope: string; validFrom: Date | null; validUntil: Date | null; revoked: boolean; parcelName: string | null }
export async function powersOfAttorney(projectId: string | null): Promise<PoaRow[]> {
  const rows = await prisma.powerOfAttorney.findMany({ where: projectId ? { projectId } : undefined, orderBy: [{ revoked: 'asc' }, { validUntil: 'asc' }], take: 1000 });
  const parcelIds = [...new Set(rows.map((r) => r.parcelId).filter((x): x is string => !!x))];
  const parcels = parcelIds.length
    ? new Map((await prisma.landParcel.findMany({ where: { id: { in: parcelIds } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]))
    : new Map<string, string>();
  return rows.map((p) => ({ id: p.id, grantor: p.grantor, attorney: p.attorney, scope: p.scope, validFrom: D(p.validFrom), validUntil: D(p.validUntil), revoked: p.revoked, parcelName: p.parcelId ? parcels.get(p.parcelId) ?? null : null }));
}

export interface JdaRow { id: string; parcelId: string; parcelName: string | null; landownerName: string; shareType: string; developerShare: number | null; landownerShare: number | null; refundableDeposit: number | null; signedOn: Date | null }
export async function jointDevelopmentAgreements(): Promise<JdaRow[]> {
  const rows = await prisma.jointDevelopmentAgreement.findMany({
    orderBy: { signedOn: 'desc' }, take: 1000,
    include: { parcel: { select: { name: true } } },
  });
  return rows.map((j) => ({ id: j.id, parcelId: j.parcelId, parcelName: j.parcel?.name ?? null, landownerName: j.landownerName, shareType: j.shareType, developerShare: numN(j.developerShare), landownerShare: numN(j.landownerShare), refundableDeposit: numN(j.refundableDeposit), signedOn: D(j.signedOn) }));
}

/**
 * Everything with a date that will hurt if it passes, in one list.
 *
 * A contract renewal, an insurance expiry, a licence and a power of attorney are
 * the same problem wearing four hats: nobody notices until the day after. This
 * is what makes the registers worth keeping rather than a filing exercise.
 */
export interface ExpiryRow { id: string; kind: 'Contract' | 'Insurance' | 'Licence' | 'Power of attorney'; title: string; who: string | null; on: Date; days: number; href: string }
export async function upcomingExpiries(withinDays = 90): Promise<ExpiryRow[]> {
  const now = new Date();
  const until = new Date(now.getTime() + withinDays * 86_400_000);
  const window = { gte: new Date(now.getTime() - 30 * 86_400_000), lte: until };

  const [cs, ps, ls, poas] = await Promise.all([
    prisma.contractRecord.findMany({ where: { renewalOn: window, status: { not: 'EXPIRED' } }, select: { id: true, title: true, counterparty: true, renewalOn: true } }).catch(() => []),
    prisma.insurancePolicy.findMany({ where: { expiresOn: window }, select: { id: true, name: true, insurer: true, expiresOn: true } }).catch(() => []),
    prisma.complianceDocExpiry.findMany({ where: { expiresOn: window, renewed: false }, select: { id: true, title: true, owner: true, expiresOn: true } }).catch(() => []),
    prisma.powerOfAttorney.findMany({ where: { validUntil: window, revoked: false }, select: { id: true, grantor: true, attorney: true, validUntil: true } }).catch(() => []),
  ]);

  const days = (d: Date) => Math.round((d.getTime() - now.getTime()) / 86_400_000);
  const out: ExpiryRow[] = [
    ...cs.filter((c) => c.renewalOn).map((c) => ({ id: c.id, kind: 'Contract' as const, title: c.title, who: c.counterparty, on: c.renewalOn!, days: days(c.renewalOn!), href: '/governance?view=contracts' })),
    ...ps.filter((p) => p.expiresOn).map((p) => ({ id: p.id, kind: 'Insurance' as const, title: p.name, who: p.insurer, on: p.expiresOn!, days: days(p.expiresOn!), href: '/governance?view=insurance' })),
    ...ls.filter((l) => l.expiresOn).map((l) => ({ id: l.id, kind: 'Licence' as const, title: l.title, who: l.owner, on: l.expiresOn!, days: days(l.expiresOn!), href: '/governance?view=renewals' })),
    ...poas.filter((p) => p.validUntil).map((p) => ({ id: p.id, kind: 'Power of attorney' as const, title: `${p.grantor} → ${p.attorney}`, who: null, on: p.validUntil!, days: days(p.validUntil!), href: '/land?view=poa' })),
  ];
  return out.sort((a, b) => a.on.getTime() - b.on.getTime());
}

/**
 * Counts for the tab strip.
 *
 * A tabbed screen shows one register and a number on each of the others. Loading
 * every tab's full rows to produce those numbers meant Governance fetched up to
 * four thousand rows to display one thousand, on a `force-dynamic` page with no
 * caching. Counts are what the badges actually need.
 */
export async function registerCounts(projectId: string | null): Promise<Record<string, number>> {
  const scope = projectId ? { projectId } : {};
  const [risk, contract, policy, renewal, decision, sop, lesson, env, waste, incident, access, poa, jda] = await Promise.all([
    prisma.riskEntry.count({ where: scope }).catch(() => 0),
    prisma.contractRecord.count({ where: scope }).catch(() => 0),
    prisma.insurancePolicy.count({ where: scope }).catch(() => 0),
    prisma.complianceDocExpiry.count({ where: scope }).catch(() => 0),
    prisma.decisionLog.count({ where: scope }).catch(() => 0),
    prisma.sop.count().catch(() => 0),
    prisma.lessonLearned.count({ where: scope }).catch(() => 0),
    prisma.envClearanceCondition.count({ where: scope }).catch(() => 0),
    prisma.wasteManifest.count({ where: scope }).catch(() => 0),
    prisma.securityIncident.count().catch(() => 0),
    prisma.accessReview.count().catch(() => 0),
    prisma.powerOfAttorney.count({ where: scope }).catch(() => 0),
    prisma.jointDevelopmentAgreement.count().catch(() => 0),
  ]);
  return { risk, contract, policy, renewal, decision, sop, lesson, env, waste, incident, access, poa, jda };
}

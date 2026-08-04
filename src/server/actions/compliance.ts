'use server';

import { revalidatePath } from 'next/cache';
import { asEnum } from '@/lib/utils/enum';
import { ContractStatus, EnvCondStatus, JdaShareType, ObligationFrequency, ObligationKind, ObligationStatus, RiskLevel, RiskStatus, SecIncidentStatus, SecOpsSeverity, SopStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';
import type { PermissionKey } from '@/lib/rbac/permissions';

export type ComplianceResult = { ok: true; message: string; id?: string } | { error: string };

const str = z.string().transform((s) => s.trim());
const optStr = (s: string) => { const t = (s ?? '').trim(); return t === '' ? null : t; };
const optDate = (s: string) => (s && s.trim() !== '' ? new Date(s) : null);
async function guard(perm: PermissionKey) { return ensure(perm); }

// Batch 3 — statutory obligation
export async function createObligation(v: Record<string, string>): Promise<ComplianceResult> {
  try {
    const ctx = await guard('statutory.manage');
    const title = str.parse(v.title ?? '');
    if (title.length < 2) return { error: 'Give the obligation a title.' };
    const o = await prisma.statutoryObligation.create({ data: {
      projectId: optStr(v.projectId ?? ''), title, kind: asEnum(ObligationKind, v.kind, 'OTHER'),
      authority: optStr(v.authority ?? ''), frequency: asEnum(ObligationFrequency, v.frequency, 'MONTHLY'),
      owner: optStr(v.owner ?? ''), nextDue: optDate(v.nextDue ?? ''), status: asEnum(ObligationStatus, v.status, 'UPCOMING'),
      createdById: ctx.user.id,
    }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'StatutoryObligation', entityId: o.id, summary: `Obligation "${title}"` });
    revalidatePath('/statutory');
    return { ok: true, message: 'Obligation added.' };
  } catch (e) { return toActionError(e); }
}

// Batch 6 — goods receipt
export async function createGoodsReceipt(v: Record<string, string>): Promise<ComplianceResult> {
  try {
    const ctx = await guard('procurement.manage');
    const vendorName = str.parse(v.vendorName ?? ''); const materialName = str.parse(v.materialName ?? '');
    if (vendorName.length < 2 || materialName.length < 2) return { error: 'Vendor and material are required.' };
    const g = await prisma.goodsReceipt.create({ data: {
      projectId: optStr(v.projectId ?? ''), vendorName, materialName,
      poReference: optStr(v.poReference ?? ''), unit: optStr(v.unit ?? ''),
      orderedQty: Number(v.orderedQty || 0), receivedQty: Number(v.receivedQty || 0), billedQty: Number(v.billedQty || 0),
      rate: v.rate ? Number(v.rate) : null, note: optStr(v.note ?? ''),
      ...(v.receivedOn && v.receivedOn.trim() !== '' ? { receivedOn: new Date(v.receivedOn) } : {}),
      createdById: ctx.user.id,
    }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'GoodsReceipt', entityId: g.id, summary: `GRN ${materialName} from ${vendorName}` });
    revalidatePath('/procurement');
    return { ok: true, message: 'Goods receipt recorded.' };
  } catch (e) { return toActionError(e); }
}

// ── GRN AI-OCR: read a goods-receipt note / delivery challan photo ───────────
export interface GrnExtract {
  vendorName: string | null; materialName: string | null; poReference: string | null; unit: string | null;
  orderedQty: number | null; receivedQty: number | null; billedQty: number | null; rate: number | null;
  receivedOn: string | null; note: string | null;
}

function pickNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function pickStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' || s.toLowerCase() === 'null' ? null : s;
}

/** Read a photographed / uploaded goods-receipt note and extract its fields with the AI reader. */
export async function extractGrnFromImage(input: { dataBase64: string; mimeType: string; filename: string }): Promise<{ ok: true; data: GrnExtract } | { error: string }> {
  try {
    await guard('procurement.manage');
    const { aiReadFile } = await import('@/lib/ai/provider');
    const okType = /^image\//.test(input.mimeType) || input.mimeType === 'application/pdf';
    if (!okType) return { error: 'Upload an image (JPG/PNG) or PDF of the goods-receipt note.' };
    const buffer = Buffer.from(input.dataBase64, 'base64');
    if (buffer.length === 0) return { error: 'The file appears to be empty.' };
    if (buffer.length > 12 * 1024 * 1024) return { error: 'That file is over 12 MB — please use a smaller photo or PDF.' };

    const prompt = [
      'This is a goods-receipt note or delivery challan for construction materials.',
      'Extract these fields and return ONLY a JSON object with exactly these keys:',
      'vendorName, materialName, poReference, unit, orderedQty, receivedQty, billedQty, rate, receivedOn, note.',
      'Quantities and rate are numbers (no commas or units). unit is the measure like bags/cft/nos/MT.',
      'receivedOn is an ISO date (YYYY-MM-DD) if a date is visible, else null.',
      'Use null for any field not present. Do not invent values.',
    ].join(' ');

    const res = await aiReadFile({ buffer, mimeType: input.mimeType, filename: input.filename }, prompt, { json: true, system: 'You are a careful data-entry assistant. Return only a valid JSON object.', maxTokens: 700 });
    if (!res.ok) return { error: res.error };

    let parsed: Record<string, unknown> = {};
    try {
      const cleaned = res.text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
      parsed = JSON.parse(start >= 0 && end >= 0 ? cleaned.slice(start, end + 1) : cleaned);
    } catch {
      return { error: 'Could not read that document clearly. Try a sharper, well-lit photo — or enter the details by hand.' };
    }

    const data: GrnExtract = {
      vendorName: pickStr(parsed.vendorName), materialName: pickStr(parsed.materialName),
      poReference: pickStr(parsed.poReference), unit: pickStr(parsed.unit),
      orderedQty: pickNum(parsed.orderedQty), receivedQty: pickNum(parsed.receivedQty), billedQty: pickNum(parsed.billedQty),
      rate: pickNum(parsed.rate), receivedOn: pickStr(parsed.receivedOn), note: pickStr(parsed.note),
    };
    return { ok: true, data };
  } catch (e) { return toActionError(e); }
}

// Batch 22 — risk
export async function createRisk(v: Record<string, string>): Promise<ComplianceResult> {
  try {
    const ctx = await guard('governance.manage');
    const title = str.parse(v.title ?? ''); if (title.length < 2) return { error: 'Name the risk.' };
    const r = await prisma.riskEntry.create({ data: {
      projectId: optStr(v.projectId ?? ''), title, category: optStr(v.category ?? ''),
      likelihood: asEnum(RiskLevel, v.likelihood, 'MEDIUM'), impact: asEnum(RiskLevel, v.impact, 'MEDIUM'),
      owner: optStr(v.owner ?? ''), mitigation: optStr(v.mitigation ?? ''), status: asEnum(RiskStatus, v.status, 'OPEN'),
      createdById: ctx.user.id,
    }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'RiskEntry', entityId: r.id, summary: `Risk "${title}"` });
    revalidatePath('/governance');
    return { ok: true, message: 'Risk added.' };
  } catch (e) { return toActionError(e); }
}

// Batch 25 — security incident
export async function createIncident(v: Record<string, string>): Promise<ComplianceResult> {
  try {
    const ctx = await guard('secops.manage');
    const title = str.parse(v.title ?? ''); if (title.length < 2) return { error: 'Name the incident.' };
    const i = await prisma.securityIncident.create({ data: {
      title, severity: asEnum(SecOpsSeverity, v.severity, 'MEDIUM'), kind: optStr(v.kind ?? ''),
      status: asEnum(SecIncidentStatus, v.status, 'OPEN'), rootCause: optStr(v.rootCause ?? ''), createdById: ctx.user.id,
    }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'SecurityIncident', entityId: i.id, summary: `Incident "${title}"` });
    revalidatePath('/security-ops');
    return { ok: true, message: 'Incident logged.' };
  } catch (e) { return toActionError(e); }
}

// Batch 29 — decision log
export async function createDecision(v: Record<string, string>): Promise<ComplianceResult> {
  try {
    const ctx = await guard('knowledge.manage');
    const title = str.parse(v.title ?? ''); const decision = str.parse(v.decision ?? '');
    if (title.length < 2 || decision.length < 2) return { error: 'Title and decision are required.' };
    const d = await prisma.decisionLog.create({ data: {
      projectId: optStr(v.projectId ?? ''), title, decidedBy: optStr(v.decidedBy ?? ''),
      context: optStr(v.context ?? ''), decision, createdById: ctx.user.id,
    }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'DecisionLog', entityId: d.id, summary: `Decision "${title}"` });
    revalidatePath('/knowledge');
    return { ok: true, message: 'Decision logged.' };
  } catch (e) { return toActionError(e); }
}

// Batch 23 — environmental clearance condition
export async function createEnvCondition(v: Record<string, string>): Promise<ComplianceResult> {
  try {
    const ctx = await guard('esg.manage');
    const condition = str.parse(v.condition ?? ''); if (condition.length < 2) return { error: 'Describe the condition.' };
    const e2 = await prisma.envClearanceCondition.create({ data: {
      projectId: optStr(v.projectId ?? ''), condition, authority: optStr(v.authority ?? ''),
      evidence: optStr(v.evidence ?? ''), dueOn: optDate(v.dueOn ?? ''), status: asEnum(EnvCondStatus, v.status, 'PENDING'),
      createdById: ctx.user.id,
    }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'EnvClearanceCondition', entityId: e2.id, summary: 'EC condition' });
    revalidatePath('/esg');
    return { ok: true, message: 'Condition added.' };
  } catch (e) { return toActionError(e); }
}

// ─── The nine registers ──────────────────────────────────────────────────────

const optNum = (s: string) => { const n = Number((s ?? '').trim()); return Number.isFinite(n) && (s ?? '').trim() !== '' ? n : null; };

export async function createContract(v: Record<string, string>): Promise<ComplianceResult> {
  try {
    const ctx = await guard('governance.manage');
    const title = str.parse(v.title ?? ''); const counterparty = str.parse(v.counterparty ?? '');
    if (title.length < 2) return { error: 'Name the contract.' };
    if (counterparty.length < 2) return { error: 'Who is it with?' };
    const r = await prisma.contractRecord.create({ data: {
      projectId: optStr(v.projectId ?? ''), title, counterparty, kind: optStr(v.kind ?? ''),
      value: optNum(v.value ?? ''), startsOn: optDate(v.startsOn ?? ''), endsOn: optDate(v.endsOn ?? ''),
      renewalOn: optDate(v.renewalOn ?? ''), obligations: optStr(v.obligations ?? ''),
      status: asEnum(ContractStatus, v.status, 'ACTIVE'), createdById: ctx.user.id,
    }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'ContractRecord', entityId: r.id, summary: `Contract "${title}" with ${counterparty}` });
    revalidatePath('/governance');
    return { ok: true, message: 'Contract added to the register.' };
  } catch (e) { return toActionError(e); }
}

export async function createInsurancePolicy(v: Record<string, string>): Promise<ComplianceResult> {
  try {
    const ctx = await guard('governance.manage');
    const name = str.parse(v.name ?? ''); const insurer = str.parse(v.insurer ?? '');
    if (name.length < 2 || insurer.length < 2) return { error: 'The policy needs a name and an insurer.' };
    const p = await prisma.insurancePolicy.create({ data: {
      projectId: optStr(v.projectId ?? ''), name, insurer, policyNo: optStr(v.policyNo ?? ''),
      cover: optNum(v.cover ?? ''), premium: optNum(v.premium ?? ''), expiresOn: optDate(v.expiresOn ?? ''),
      claims: optStr(v.claims ?? ''),
    }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'InsurancePolicy', entityId: p.id, summary: `Policy "${name}" with ${insurer}` });
    revalidatePath('/governance');
    return { ok: true, message: 'Policy recorded.' };
  } catch (e) { return toActionError(e); }
}

export async function createRenewal(v: Record<string, string>): Promise<ComplianceResult> {
  try {
    const ctx = await guard('governance.manage');
    const title = str.parse(v.title ?? '');
    if (title.length < 2) return { error: 'Name the licence or certificate.' };
    const c = await prisma.complianceDocExpiry.create({ data: {
      projectId: optStr(v.projectId ?? ''), title, category: optStr(v.category ?? ''),
      reference: optStr(v.reference ?? ''), expiresOn: optDate(v.expiresOn ?? ''),
      owner: optStr(v.owner ?? ''), renewed: (v.renewed ?? '') === 'YES',
    }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'ComplianceDocExpiry', entityId: c.id, summary: `Renewal tracked: ${title}` });
    revalidatePath('/governance');
    return { ok: true, message: 'Added to the renewals watch.' };
  } catch (e) { return toActionError(e); }
}

export async function createSop(v: Record<string, string>): Promise<ComplianceResult> {
  try {
    const ctx = await guard('knowledge.manage');
    const title = str.parse(v.title ?? '');
    if (title.length < 2) return { error: 'Give the SOP a title.' };
    const s = await prisma.sop.create({ data: {
      title, department: optStr(v.department ?? ''), content: optStr(v.content ?? ''),
      effectiveOn: optDate(v.effectiveOn ?? ''), status: asEnum(SopStatus, v.status, 'DRAFT'),
      createdById: ctx.user.id,
    }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Sop', entityId: s.id, summary: `SOP "${title}"` });
    revalidatePath('/knowledge');
    return { ok: true, message: 'SOP added.' };
  } catch (e) { return toActionError(e); }
}

export async function createLesson(v: Record<string, string>): Promise<ComplianceResult> {
  try {
    const ctx = await guard('knowledge.manage');
    const title = str.parse(v.title ?? ''); const recommendation = str.parse(v.recommendation ?? '');
    if (title.length < 2 || recommendation.length < 2) return { error: 'A lesson needs a title and what to do differently.' };
    const l = await prisma.lessonLearned.create({ data: {
      projectId: optStr(v.projectId ?? ''), title, category: optStr(v.category ?? ''),
      situation: optStr(v.situation ?? ''), recommendation, createdById: ctx.user.id,
    }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'LessonLearned', entityId: l.id, summary: `Lesson "${title}"` });
    revalidatePath('/knowledge');
    return { ok: true, message: 'Lesson captured.' };
  } catch (e) { return toActionError(e); }
}

export async function createWasteManifest(v: Record<string, string>): Promise<ComplianceResult> {
  try {
    const ctx = await guard('esg.manage');
    const wasteType = str.parse(v.wasteType ?? '');
    if (wasteType.length < 2) return { error: 'What waste was it?' };
    const qty = optNum(v.quantity ?? '');
    const w = await prisma.wasteManifest.create({ data: {
      projectId: optStr(v.projectId ?? ''), manifestNo: optStr(v.manifestNo ?? ''), wasteType,
      quantity: qty ?? 0, unit: optStr(v.unit ?? ''), disposedTo: optStr(v.disposedTo ?? ''),
      disposedOn: optDate(v.disposedOn ?? ''),
    }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'WasteManifest', entityId: w.id, summary: `Waste manifest: ${wasteType}` });
    revalidatePath('/esg');
    return { ok: true, message: 'Manifest recorded.' };
  } catch (e) { return toActionError(e); }
}

export async function createAccessReview(v: Record<string, string>): Promise<ComplianceResult> {
  try {
    const ctx = await guard('secops.manage');
    const subject = str.parse(v.subject ?? '');
    if (subject.length < 2) return { error: 'What is being reviewed?' };
    const a = await prisma.accessReview.create({ data: {
      subject, scope: optStr(v.scope ?? ''), reviewer: optStr(v.reviewer ?? ''),
      dueOn: optDate(v.dueOn ?? ''), completedOn: optDate(v.completedOn ?? ''), findings: optStr(v.findings ?? ''),
    }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'AccessReview', entityId: a.id, summary: `Access review: ${subject}` });
    revalidatePath('/security-ops');
    return { ok: true, message: 'Review scheduled.' };
  } catch (e) { return toActionError(e); }
}

export async function createPowerOfAttorney(v: Record<string, string>): Promise<ComplianceResult> {
  try {
    const ctx = await guard('land.manage');
    const grantor = str.parse(v.grantor ?? ''); const attorney = str.parse(v.attorney ?? ''); const scope = str.parse(v.scope ?? '');
    if (grantor.length < 2 || attorney.length < 2) return { error: 'Both the grantor and the attorney are needed.' };
    if (scope.length < 2) return { error: 'Say what the power covers — an unbounded POA is the one nobody should sign.' };
    const p = await prisma.powerOfAttorney.create({ data: {
      parcelId: optStr(v.parcelId ?? ''), projectId: optStr(v.projectId ?? ''),
      grantor, attorney, scope, validFrom: optDate(v.validFrom ?? ''), validUntil: optDate(v.validUntil ?? ''),
      revoked: (v.revoked ?? '') === 'YES',
    }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'PowerOfAttorney', entityId: p.id, summary: `POA ${grantor} → ${attorney}` });
    revalidatePath('/land');
    return { ok: true, message: 'Power of attorney recorded.' };
  } catch (e) { return toActionError(e); }
}

export async function createJda(v: Record<string, string>): Promise<ComplianceResult> {
  try {
    const ctx = await guard('land.manage');
    const parcelId = (v.parcelId ?? '').trim();
    const landownerName = str.parse(v.landownerName ?? '');
    if (!parcelId) return { error: 'A JDA has to sit against a land parcel.' };
    if (landownerName.length < 2) return { error: 'Name the landowner.' };
    const parcel = await prisma.landParcel.findUnique({ where: { id: parcelId }, select: { id: true, name: true } });
    if (!parcel) return { error: 'That land parcel no longer exists.' };

    const dev = optNum(v.developerShare ?? '');
    const own = optNum(v.landownerShare ?? '');
    // The two shares are the whole commercial substance of a JDA. If both are
    // given they must add up, or the agreement in the system is not the one on paper.
    if (dev !== null && own !== null && Math.abs(dev + own - 100) > 0.01) {
      return { error: `The shares add up to ${(dev + own).toFixed(2)}%, not 100%.` };
    }

    const j = await prisma.jointDevelopmentAgreement.create({ data: {
      parcelId: parcel.id, landownerName, shareType: asEnum(JdaShareType, v.shareType, 'AREA_SHARE'),
      developerShare: dev, landownerShare: own, refundableDeposit: optNum(v.refundableDeposit ?? ''),
      signedOn: optDate(v.signedOn ?? ''), obligations: optStr(v.obligations ?? ''),
    }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'JointDevelopmentAgreement', entityId: j.id, summary: `JDA on ${parcel.name} with ${landownerName}` });
    revalidatePath('/land');
    return { ok: true, message: 'JDA recorded.' };
  } catch (e) { return toActionError(e); }
}

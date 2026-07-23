'use server';

import { revalidatePath } from 'next/cache';
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
      projectId: optStr(v.projectId ?? ''), title, kind: (v.kind || 'OTHER') as never,
      authority: optStr(v.authority ?? ''), frequency: (v.frequency || 'MONTHLY') as never,
      owner: optStr(v.owner ?? ''), nextDue: optDate(v.nextDue ?? ''), status: (v.status || 'UPCOMING') as never,
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
      likelihood: (v.likelihood || 'MEDIUM') as never, impact: (v.impact || 'MEDIUM') as never,
      owner: optStr(v.owner ?? ''), mitigation: optStr(v.mitigation ?? ''), status: (v.status || 'OPEN') as never,
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
      title, severity: (v.severity || 'MEDIUM') as never, kind: optStr(v.kind ?? ''),
      status: (v.status || 'OPEN') as never, rootCause: optStr(v.rootCause ?? ''), createdById: ctx.user.id,
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
      evidence: optStr(v.evidence ?? ''), dueOn: optDate(v.dueOn ?? ''), status: (v.status || 'PENDING') as never,
      createdById: ctx.user.id,
    }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'EnvClearanceCondition', entityId: e2.id, summary: 'EC condition' });
    revalidatePath('/esg');
    return { ok: true, message: 'Condition added.' };
  } catch (e) { return toActionError(e); }
}

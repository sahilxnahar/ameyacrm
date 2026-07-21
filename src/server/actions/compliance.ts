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
      createdById: ctx.user.id,
    }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'GoodsReceipt', entityId: g.id, summary: `GRN ${materialName} from ${vendorName}` });
    revalidatePath('/procurement');
    return { ok: true, message: 'Goods receipt recorded.' };
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

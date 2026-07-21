'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';
import type { PermissionKey } from '@/lib/rbac/permissions';

export type OpsResult = { ok: true; message: string; id?: string } | { error: string };
const req = z.string().transform((s) => (s ?? '').trim());
const opt = (s: string) => { const t = (s ?? '').trim(); return t === '' ? null : t; };
const optDate = (s: string) => (s && s.trim() !== '' ? new Date(s) : null);
async function guard(p: PermissionKey) { return ensure(p); }

export async function createVariation(v: Record<string, string>): Promise<OpsResult> {
  try {
    const ctx = await guard('variations.manage');
    const title = req.parse(v.title ?? ''); if (title.length < 2) return { error: 'Name the variation.' };
    const x = await prisma.variationOrder.create({ data: { projectId: opt(v.projectId ?? ''), bookingRef: opt(v.bookingRef ?? ''), title, description: opt(v.description ?? ''), amount: Number(v.amount || 0), status: (v.status || 'RAISED'), createdById: ctx.user.id }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'VariationOrder', entityId: x.id, summary: `Variation "${title}"` });
    revalidatePath('/variations'); return { ok: true, message: 'Variation raised.' };
  } catch (e) { return toActionError(e); }
}

export async function createExpense(v: Record<string, string>): Promise<OpsResult> {
  try {
    const ctx = await guard('people.manage');
    const claimant = req.parse(v.claimant ?? ''); if (claimant.length < 2) return { error: 'Who is claiming?' };
    const x = await prisma.expenseClaim.create({ data: { projectId: opt(v.projectId ?? ''), claimant, category: opt(v.category ?? ''), amount: Number(v.amount || 0), status: (v.status || 'SUBMITTED'), incurredOn: optDate(v.incurredOn ?? ''), note: opt(v.note ?? ''), createdById: ctx.user.id }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'ExpenseClaim', entityId: x.id, summary: `Expense ${claimant} ${v.amount}` });
    revalidatePath('/expenses'); return { ok: true, message: 'Expense claim added.' };
  } catch (e) { return toActionError(e); }
}

export async function createMaintenance(v: Record<string, string>): Promise<OpsResult> {
  try {
    const ctx = await guard('association.manage');
    const unitCode = req.parse(v.unitCode ?? ''); if (unitCode.length < 1) return { error: 'Unit code required.' };
    const x = await prisma.maintenanceCharge.create({ data: { projectId: opt(v.projectId ?? ''), unitCode, period: opt(v.period ?? ''), amount: Number(v.amount || 0), status: (v.status || 'RAISED'), dueOn: optDate(v.dueOn ?? '') }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'MaintenanceCharge', entityId: x.id, summary: `CAM ${unitCode}` });
    revalidatePath('/association'); return { ok: true, message: 'Maintenance charge raised.' };
  } catch (e) { return toActionError(e); }
}

export async function createTransmittal(v: Record<string, string>): Promise<OpsResult> {
  try {
    const ctx = await guard('architecture.manage');
    const drawingRef = req.parse(v.drawingRef ?? ''); const title = req.parse(v.title ?? '');
    if (drawingRef.length < 1 || title.length < 2) return { error: 'Drawing ref and title required.' };
    const x = await prisma.drawingTransmittal.create({ data: { projectId: opt(v.projectId ?? ''), drawingRef, title, revision: opt(v.revision ?? ''), issuedTo: req.parse(v.issuedTo ?? '') || 'contractor', note: opt(v.note ?? ''), createdById: ctx.user.id }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'DrawingTransmittal', entityId: x.id, summary: `Transmittal ${drawingRef}` });
    revalidatePath('/transmittals'); return { ok: true, message: 'Transmittal recorded.' };
  } catch (e) { return toActionError(e); }
}

export async function createWalkIn(v: Record<string, string>): Promise<OpsResult> {
  try {
    const ctx = await guard('lead.create');
    const name = req.parse(v.name ?? ''); if (name.length < 2) return { error: 'Name required.' };
    const x = await prisma.walkIn.create({ data: { projectId: opt(v.projectId ?? ''), name, phone: opt(v.phone ?? ''), source: opt(v.source ?? ''), outcome: opt(v.outcome ?? ''), createdById: ctx.user.id }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'WalkIn', entityId: x.id, summary: `Walk-in ${name}` });
    revalidatePath('/walk-ins'); return { ok: true, message: 'Walk-in logged.' };
  } catch (e) { return toActionError(e); }
}

export async function createTenancy(v: Record<string, string>): Promise<OpsResult> {
  try {
    const ctx = await guard('lease.manage');
    const unitCode = req.parse(v.unitCode ?? ''); const tenant = req.parse(v.tenant ?? '');
    if (unitCode.length < 1 || tenant.length < 2) return { error: 'Unit and tenant required.' };
    const x = await prisma.commercialTenancy.create({ data: { projectId: opt(v.projectId ?? ''), unitCode, tenant, areaSqft: v.areaSqft ? Number(v.areaSqft) : null, monthlyRent: Number(v.monthlyRent || 0), escalationPct: v.escalationPct ? Number(v.escalationPct) : null, startsOn: optDate(v.startsOn ?? ''), endsOn: optDate(v.endsOn ?? ''), status: (v.status || 'ACTIVE') }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'CommercialTenancy', entityId: x.id, summary: `Tenancy ${unitCode} → ${tenant}` });
    revalidatePath('/leasing'); return { ok: true, message: 'Tenancy added.' };
  } catch (e) { return toActionError(e); }
}

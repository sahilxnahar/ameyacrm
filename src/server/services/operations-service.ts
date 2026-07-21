import 'server-only';
import { prisma } from '@/lib/db/prisma';
const num = (d: unknown): number => (d == null ? 0 : Number(d));
const numN = (d: unknown): number | null => (d == null ? null : Number(d));

export interface VariationRow { id: string; title: string; bookingRef: string | null; amount: number; status: string; raisedOn: Date; }
export async function variations(projectId: string | null): Promise<VariationRow[]> {
  const r = await prisma.variationOrder.findMany({ where: projectId ? { projectId } : undefined, orderBy: [{ status: 'asc' }, { raisedOn: 'desc' }], take: 1000 });
  return r.map((v) => ({ id: v.id, title: v.title, bookingRef: v.bookingRef, amount: num(v.amount), status: v.status, raisedOn: v.raisedOn }));
}

export interface ExpenseRow { id: string; claimant: string; category: string | null; amount: number; status: string; incurredOn: Date | null; }
export async function expenses(projectId: string | null): Promise<ExpenseRow[]> {
  const r = await prisma.expenseClaim.findMany({ where: projectId ? { projectId } : undefined, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 1000 });
  return r.map((e) => ({ id: e.id, claimant: e.claimant, category: e.category, amount: num(e.amount), status: e.status, incurredOn: e.incurredOn }));
}

export interface MaintenanceRow { id: string; unitCode: string; period: string | null; amount: number; status: string; dueOn: Date | null; }
export async function maintenanceCharges(projectId: string | null): Promise<MaintenanceRow[]> {
  const r = await prisma.maintenanceCharge.findMany({ where: projectId ? { projectId } : undefined, orderBy: [{ status: 'asc' }, { dueOn: 'asc' }], take: 2000 });
  return r.map((m) => ({ id: m.id, unitCode: m.unitCode, period: m.period, amount: num(m.amount), status: m.status, dueOn: m.dueOn }));
}

export interface TransmittalRow { id: string; drawingRef: string; title: string; revision: string | null; issuedTo: string; issuedOn: Date; acknowledged: boolean; }
export async function transmittals(projectId: string | null): Promise<TransmittalRow[]> {
  const r = await prisma.drawingTransmittal.findMany({ where: projectId ? { projectId } : undefined, orderBy: { issuedOn: 'desc' }, take: 1000 });
  return r.map((t) => ({ id: t.id, drawingRef: t.drawingRef, title: t.title, revision: t.revision, issuedTo: t.issuedTo, issuedOn: t.issuedOn, acknowledged: t.acknowledged }));
}

export interface WalkInRow { id: string; name: string; phone: string | null; source: string | null; visitedOn: Date; outcome: string | null; }
export async function walkIns(projectId: string | null): Promise<WalkInRow[]> {
  const r = await prisma.walkIn.findMany({ where: projectId ? { projectId } : undefined, orderBy: { visitedOn: 'desc' }, take: 1000 });
  return r.map((w) => ({ id: w.id, name: w.name, phone: w.phone, source: w.source, visitedOn: w.visitedOn, outcome: w.outcome }));
}

export interface TenancyRow { id: string; unitCode: string; tenant: string; areaSqft: number | null; monthlyRent: number; escalationPct: number | null; startsOn: Date | null; endsOn: Date | null; status: string; }
export async function tenancies(projectId: string | null): Promise<TenancyRow[]> {
  const r = await prisma.commercialTenancy.findMany({ where: projectId ? { projectId } : undefined, orderBy: [{ status: 'asc' }, { unitCode: 'asc' }], take: 1000 });
  return r.map((t) => ({ id: t.id, unitCode: t.unitCode, tenant: t.tenant, areaSqft: numN(t.areaSqft), monthlyRent: num(t.monthlyRent), escalationPct: numN(t.escalationPct), startsOn: t.startsOn, endsOn: t.endsOn, status: t.status }));
}

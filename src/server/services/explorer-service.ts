import 'server-only';
import { prisma } from '@/lib/db/prisma';

export type ExplorerEntity = 'leads' | 'bookings' | 'units' | 'collections';
export interface ExplorerFilters { status?: string; source?: string; ownerId?: string; projectId?: string; q?: string; from?: string; to?: string; temperature?: string }
export interface ExplorerResult { columns: string[]; rows: Record<string, string | number>[]; total: number }

const dateRange = (f: ExplorerFilters) => {
  const gte = f.from ? new Date(f.from) : undefined;
  const lte = f.to ? new Date(`${f.to}T23:59:59`) : undefined;
  return gte || lte ? { gte, lte } : undefined;
};
const money = (v: unknown) => (v == null ? '' : Number(v));
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');

/** One query builder shared by the on-screen explorer and the CSV export. */
export async function runExplorer(entity: ExplorerEntity, f: ExplorerFilters, limit = 500): Promise<ExplorerResult> {
  if (entity === 'bookings') {
    const where = { ...(f.status ? { status: f.status as never } : {}), ...(dateRange(f) ? { bookedAt: dateRange(f) } : {}) };
    const [rows, total] = await Promise.all([
      prisma.booking.findMany({ where, include: { lead: { select: { name: true } }, unit: { select: { code: true } } }, orderBy: { bookedAt: 'desc' }, take: limit }),
      prisma.booking.count({ where }),
    ]);
    return {
      columns: ['reference', 'buyer', 'unit', 'status', 'payment', 'agreementValue', 'bookedAt'], total,
      rows: rows.map((b) => ({ reference: b.reference, buyer: b.lead?.name ?? '', unit: b.unit?.code ?? '', status: b.status, payment: b.paymentStatus, agreementValue: money(b.agreementValue), bookedAt: day(b.bookedAt) })),
    };
  }
  if (entity === 'units') {
    const where = { ...(f.status ? { status: f.status as never } : {}), ...(f.projectId ? { projectId: f.projectId } : {}) };
    const [rows, total] = await Promise.all([
      prisma.unit.findMany({ where, include: { project: { select: { name: true } } }, orderBy: [{ tower: 'asc' }, { code: 'asc' }], take: limit }),
      prisma.unit.count({ where }),
    ]);
    return {
      columns: ['code', 'project', 'tower', 'floor', 'typology', 'carpetAreaSqft', 'price', 'status'], total,
      rows: rows.map((u) => ({ code: u.code, project: u.project?.name ?? '', tower: u.tower ?? '', floor: u.floor ?? '', typology: u.typology ?? '', carpetAreaSqft: money(u.carpetAreaSqft), price: money(u.price), status: u.status })),
    };
  }
  if (entity === 'collections') {
    const where = { ...(f.status ? { status: f.status as never } : {}), ...(dateRange(f) ? { dueDate: dateRange(f) } : {}) };
    const [rows, total] = await Promise.all([
      prisma.paymentMilestone.findMany({ where, include: { booking: { select: { reference: true, lead: { select: { name: true } } } } }, orderBy: { dueDate: 'asc' }, take: limit }),
      prisma.paymentMilestone.count({ where }),
    ]);
    return {
      columns: ['booking', 'buyer', 'milestone', 'amount', 'dueDate', 'status', 'paidAt'], total,
      rows: rows.map((m) => ({ booking: m.booking?.reference ?? '', buyer: m.booking?.lead?.name ?? '', milestone: m.label, amount: money(m.amount), dueDate: day(m.dueDate), status: m.status, paidAt: day(m.paidAt) })),
    };
  }
  // leads (default)
  const where = {
    deletedAt: null,
    ...(f.status ? { status: f.status as never } : {}),
    ...(f.source ? { source: f.source as never } : {}),
    ...(f.temperature ? { temperature: f.temperature as never } : {}),
    ...(f.ownerId ? { ownerId: f.ownerId } : {}),
    ...(f.projectId ? { projectId: f.projectId } : {}),
    ...(dateRange(f) ? { createdAt: dateRange(f) } : {}),
    ...(f.q ? { OR: [{ name: { contains: f.q, mode: 'insensitive' as const } }, { email: { contains: f.q, mode: 'insensitive' as const } }, { phone: { contains: f.q } }, { reference: { contains: f.q, mode: 'insensitive' as const } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.lead.findMany({ where, include: { owner: { select: { name: true } }, project: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: limit }),
    prisma.lead.count({ where }),
  ]);
  return {
    columns: ['reference', 'name', 'phone', 'email', 'status', 'temperature', 'source', 'owner', 'project', 'score', 'budgetMax', 'createdAt'], total,
    rows: rows.map((l) => ({ reference: l.reference, name: l.name, phone: l.phone ?? '', email: l.email ?? '', status: l.status, temperature: l.temperature, source: l.source, owner: l.owner?.name ?? '', project: l.project?.name ?? '', score: l.score, budgetMax: money(l.budgetMax), createdAt: day(l.createdAt) })),
  };
}

'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { addMonths, differenceInCalendarMonths } from 'date-fns';
import type { MaintenanceStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { nextReference } from '@/lib/utils/reference';
import { writeAudit } from '@/lib/audit/log';
import { notify } from '@/lib/notifications/notify';
import { ensure, toActionError } from './_helpers';

export type LeaseResult = { ok: true; id: string } | { error: string };

const tenantSchema = z.object({
  name: z.string().min(2).max(160),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  company: z.string().max(160).optional(),
});
export async function createTenant(input: unknown): Promise<LeaseResult> {
  try {
    const ctx = await ensure('lease.manage');
    const d = tenantSchema.parse(input);
    const t = await prisma.tenant.create({ data: { name: d.name, email: d.email || null, phone: d.phone || null, company: d.company || null } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Tenant', entityId: t.id, summary: `Added tenant ${d.name}` });
    revalidatePath('/lease');
    return { ok: true, id: t.id };
  } catch (err) { return toActionError(err); }
}

const leaseSchema = z.object({
  tenantId: z.string().min(1, 'Select a tenant'),
  unitId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  rentAmount: z.coerce.number().positive(),
  deposit: z.coerce.number().nonnegative().optional(),
  escalationPct: z.coerce.number().min(0).max(100).optional(),
  noticePeriodDays: z.coerce.number().int().nonnegative().optional(),
});

export async function createLease(input: unknown): Promise<LeaseResult> {
  try {
    const ctx = await ensure('lease.manage');
    const d = leaseSchema.parse(input);
    const start = new Date(d.startDate);
    const end = new Date(d.endDate);
    if (end <= start) return { error: 'End date must be after start date.' };
    const reference = await nextReference('LSE');
    const now = new Date();
    const status = start <= now && now <= end ? 'ACTIVE' : start > now ? 'DRAFT' : 'EXPIRED';

    // Monthly rent schedule (capped at 24 rows to stay reasonable).
    const months = Math.min(Math.max(differenceInCalendarMonths(end, start), 1), 24);
    const schedule = Array.from({ length: months }).map((_, i) => ({
      label: `Rent ${i + 1}`, dueDate: addMonths(start, i), amount: d.rentAmount, status: 'PENDING' as const,
    }));

    const lease = await prisma.lease.create({
      data: {
        reference, tenantId: d.tenantId, unitId: d.unitId || null, projectId: d.projectId || null,
        managerId: ctx.user.id, startDate: start, endDate: end, rentAmount: d.rentAmount,
        deposit: d.deposit ?? null, escalationPct: d.escalationPct ?? null,
        noticePeriodDays: d.noticePeriodDays ?? null, status,
        rentSchedule: { create: schedule },
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Lease', entityId: lease.id, summary: `Created lease ${reference}` });
    revalidatePath('/lease');
    return { ok: true, id: lease.id };
  } catch (err) { return toActionError(err); }
}

const maintSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  leaseId: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  assignedToId: z.string().optional().nullable(),
});
export async function createMaintenanceRequest(input: unknown): Promise<LeaseResult> {
  try {
    const ctx = await ensure('lease.view');
    const d = maintSchema.parse(input);
    const reference = await nextReference('MNT');
    const m = await prisma.maintenanceRequest.create({
      data: {
        reference, title: d.title, description: d.description || null, leaseId: d.leaseId || null,
        priority: d.priority, reportedById: ctx.user.id, assignedToId: d.assignedToId || null,
      },
    });
    if (d.assignedToId) await notify({ userId: d.assignedToId, type: 'SYSTEM', title: `Maintenance assigned: ${d.title}`, link: '/lease' });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'MaintenanceRequest', entityId: m.id, summary: `Raised ${reference}` });
    revalidatePath('/lease');
    return { ok: true, id: m.id };
  } catch (err) { return toActionError(err); }
}

export async function updateMaintenanceStatus(id: string, status: MaintenanceStatus): Promise<LeaseResult> {
  try {
    const ctx = await ensure('lease.manage');
    await prisma.maintenanceRequest.update({ where: { id }, data: { status, resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? new Date() : null } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'MaintenanceRequest', entityId: id, summary: `Status → ${status}` });
    revalidatePath('/lease');
    return { ok: true, id };
  } catch (err) { return toActionError(err); }
}

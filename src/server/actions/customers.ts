'use server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type CustResult = { ok: true; id?: string; token?: string } | { error: string };
const newToken = () => randomBytes(20).toString('hex');

const custSchema = z.object({
  name: z.string().min(2).max(160),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  bookingId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
});
export async function createCustomer(input: unknown): Promise<CustResult> {
  try {
    const ctx = await ensure('booking.manage');
    const d = custSchema.parse(input);
    let projectId = d.projectId || null;
    if (d.bookingId && !projectId) {
      const bk = await prisma.booking.findUnique({ where: { id: d.bookingId }, include: { unit: { select: { projectId: true } } } });
      projectId = bk?.unit?.projectId ?? null;
    }
    const c = await prisma.customer.create({ data: { name: d.name, email: d.email || null, phone: d.phone || null, bookingId: d.bookingId || null, projectId, portalToken: newToken(), onboardedById: ctx.user.id } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Customer', entityId: c.id, summary: `Onboarded buyer ${d.name}` });
    revalidatePath('/customers');
    return { ok: true, id: c.id, token: c.portalToken };
  } catch (err) { return toActionError(err); }
}
export async function regenPortalToken(id: string): Promise<CustResult> {
  try { const ctx = await ensure('booking.manage'); const c = await prisma.customer.update({ where: { id }, data: { portalToken: newToken() } }); await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Customer', entityId: id, summary: 'Regenerated portal link' }); revalidatePath('/customers'); return { ok: true, token: c.portalToken }; } catch (err) { return toActionError(err); }
}
export async function setCustomerActive(id: string, isActive: boolean): Promise<CustResult> {
  try { const ctx = await ensure('booking.manage'); await prisma.customer.update({ where: { id }, data: { isActive } }); await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Customer', entityId: id, summary: `Portal ${isActive ? 'enabled' : 'disabled'}` }); revalidatePath('/customers'); return { ok: true }; } catch (err) { return toActionError(err); }
}

const cuSchema = z.object({ projectId: z.string().min(1), title: z.string().min(2).max(160), body: z.string().max(2000).optional(), milestone: z.string().max(80).optional(), imageUrl: z.string().max(500).optional().or(z.literal('')) });
export async function postConstructionUpdate(input: unknown): Promise<CustResult> {
  try { const ctx = await ensure('booking.manage'); const d = cuSchema.parse(input); const u = await prisma.constructionUpdate.create({ data: { projectId: d.projectId, title: d.title, body: d.body || null, milestone: d.milestone || null, imageUrl: d.imageUrl || null, createdById: ctx.user.id } }); await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'ConstructionUpdate', entityId: u.id, summary: `Posted update: ${d.title}` }); revalidatePath('/customers'); return { ok: true, id: u.id }; } catch (err) { return toActionError(err); }
}
export async function deleteConstructionUpdate(id: string): Promise<CustResult> {
  try { const ctx = await ensure('booking.manage'); await prisma.constructionUpdate.delete({ where: { id } }); await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'ConstructionUpdate', entityId: id }); revalidatePath('/customers'); return { ok: true }; } catch (err) { return toActionError(err); }
}

const cdSchema = z.object({ customerId: z.string().min(1), title: z.string().min(2).max(160), category: z.string().max(60).optional(), url: z.string().min(3).max(500) });
export async function addCustomerDocument(input: unknown): Promise<CustResult> {
  try { const ctx = await ensure('booking.manage'); const d = cdSchema.parse(input); const doc = await prisma.customerDocument.create({ data: { customerId: d.customerId, title: d.title, category: d.category || null, url: d.url } }); await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'CustomerDocument', entityId: doc.id, summary: `Added vault doc: ${d.title}` }); revalidatePath('/customers'); return { ok: true }; } catch (err) { return toActionError(err); }
}

export async function setSnagStatus(id: string, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'): Promise<CustResult> {
  try { const ctx = await ensure('booking.manage'); await prisma.snagTicket.update({ where: { id }, data: { status, resolvedAt: status === 'RESOLVED' ? new Date() : null } }); await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'SnagTicket', entityId: id, summary: `Snag → ${status}` }); revalidatePath('/customers'); return { ok: true }; } catch (err) { return toActionError(err); }
}
export async function assignSnag(id: string, assignedToId: string | null): Promise<CustResult> {
  try { const ctx = await ensure('booking.manage'); await prisma.snagTicket.update({ where: { id }, data: { assignedToId, status: assignedToId ? 'IN_PROGRESS' : undefined } }); await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'SnagTicket', entityId: id, summary: 'Assigned snag' }); revalidatePath('/customers'); return { ok: true }; } catch (err) { return toActionError(err); }
}

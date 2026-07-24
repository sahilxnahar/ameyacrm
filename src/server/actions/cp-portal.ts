'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { nextReference } from '@/lib/utils/reference';

const schema = z.object({
  token: z.string().min(10),
  name: z.string().min(2, 'Client name is required').max(160),
  phone: z.string().min(5, 'Phone is required').max(30),
  email: z.string().email().optional().or(z.literal('')),
  requirement: z.string().max(500).optional(),
});

/**
 * Public: a channel partner registers a lead from their portal. Auth is the
 * unguessable portal token. Anti-poaching is enforced here just like the internal
 * flow — if the client is already locked to another CP, registration is refused.
 */
export async function cpRegisterLead(input: unknown): Promise<{ ok: true } | { error: string }> {
  try {
    const d = schema.parse(input);
    const cp = await prisma.channelPartner.findUnique({ where: { portalToken: d.token }, select: { id: true, status: true, firmName: true } });
    if (!cp || cp.status === 'SUSPENDED') return { error: 'This partner portal link is invalid or has been suspended.' };

    const email = d.email ? d.email.toLowerCase() : null;
    const existing = await prisma.lead.findFirst({
      where: { deletedAt: null, OR: [{ phone: d.phone }, ...(email ? [{ email }] : [])] },
      select: { id: true, channelPartnerId: true, cpLockedUntil: true },
    });
    if (existing?.channelPartnerId && existing.channelPartnerId !== cp.id && existing.cpLockedUntil && existing.cpLockedUntil > new Date()) {
      return { error: 'This client is already registered by another channel partner. Please contact the sales office.' };
    }

    const lockUntil = new Date(Date.now() + 60 * 864e5);
    if (existing) {
      await prisma.lead.update({ where: { id: existing.id }, data: { channelPartnerId: cp.id, cpLockedUntil: lockUntil, source: 'BROKER' } });
    } else {
      const reference = await nextReference('LEAD');
      await prisma.lead.create({
        data: { reference, name: d.name, phone: d.phone, email, source: 'BROKER', requirement: d.requirement || null, channelPartnerId: cp.id, cpLockedUntil: lockUntil },
      });
    }
    revalidatePath(`/cp/${d.token}`);
    return { ok: true };
  } catch {
    return { error: 'Could not register this client. Please check the details and try again.' };
  }
}

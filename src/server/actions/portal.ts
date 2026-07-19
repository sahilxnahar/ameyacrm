'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';

const snagSchema = z.object({
  token: z.string().min(10),
  title: z.string().min(2).max(160),
  description: z.string().max(1000).optional(),
  category: z.string().max(60).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});
/** Public: a buyer raises a snag/issue from their portal. Auth is the unguessable portal token. */
export async function submitSnag(input: unknown): Promise<{ ok: true } | { error: string }> {
  try {
    const d = snagSchema.parse(input);
    const customer = await prisma.customer.findUnique({ where: { portalToken: d.token }, select: { id: true, isActive: true } });
    if (!customer || !customer.isActive) return { error: 'This portal link is invalid or has been disabled.' };
    await prisma.snagTicket.create({ data: { customerId: customer.id, title: d.title, description: d.description || null, category: d.category || null, priority: d.priority } });
    revalidatePath(`/portal/${d.token}`);
    return { ok: true };
  } catch {
    return { error: 'Could not submit. Please check the details and try again.' };
  }
}

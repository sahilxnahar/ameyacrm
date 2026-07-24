'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { classifySnag, snagRouteKey, snagKindLabel } from '@/lib/portal/snag-sla';
import { notifyUsers } from '@/lib/notify/notify';
import { fireAndForget } from '@/lib/resilience/safely';

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
    const customer = await prisma.customer.findUnique({ where: { portalToken: d.token }, select: { id: true, isActive: true, name: true } });
    if (!customer || !customer.isActive) return { error: 'This portal link is invalid or has been disabled.' };

    // Classify → route to the right person (structural/services → certifying
    // engineer; finishing → site supervisor), and start the SLA clock.
    const kind = classifySnag(d.category, `${d.title} ${d.description ?? ''}`);
    const routeRow = await prisma.setting.findUnique({ where: { key: snagRouteKey(kind) } });
    const routeUserId = typeof routeRow?.value === 'string' && routeRow.value ? routeRow.value : null;

    const ticket = await prisma.snagTicket.create({
      data: {
        customerId: customer.id, title: d.title, description: d.description || null,
        category: d.category || kind, priority: d.priority,
        assignedToId: routeUserId, status: routeUserId ? 'IN_PROGRESS' : 'OPEN',
      },
    });
    if (routeUserId) {
      fireAndForget(
        () => notifyUsers([routeUserId], { type: 'SYSTEM', title: `New ${snagKindLabel(kind)} snag from ${customer.name}`, body: d.title, link: '/customers' }),
        'snag route notify',
      );
    }
    revalidatePath(`/portal/${d.token}`);
    void ticket;
    return { ok: true };
  } catch {
    return { error: 'Could not submit. Please check the details and try again.' };
  }
}

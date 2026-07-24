import 'server-only';
import { prisma } from '@/lib/db/prisma';

/** Find an existing (non-deleted) lead matching phone or email — the core of commission protection. */
export async function findDuplicateLead(phone: string | null, email: string | null) {
  if (!phone && !email) return null;
  const or: Array<{ phone?: string; email?: string }> = [];
  if (phone) or.push({ phone });
  if (email) or.push({ email });
  return prisma.lead.findFirst({ where: { deletedAt: null, OR: or }, orderBy: { createdAt: 'asc' }, select: { id: true, ownerId: true, reference: true, name: true } });
}

import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { departmentIdsFor } from './department-service';

export interface VisibleTemplate {
  id: string; key: string; name: string; channel: string; category: string | null;
  subject: string | null; header: string | null; body: string; footer: string | null;
  description: string | null; departmentName: string | null; usageCount: number;
}

/**
 * The templates a person may see.
 *
 * Scoped to the departments they belong to — their main one and any extras.
 * Finance wording stays with finance. Templates with no department set are
 * shown to administrators only: they pre-date the change, and guessing that an
 * unlabelled template is safe for everyone is exactly the guess that leaks
 * something.
 */
export async function templatesFor(
  userId: string,
  opts: { seesEverything: boolean },
): Promise<VisibleTemplate[]> {
  const where = opts.seesEverything
    ? { isActive: true }
    : { isActive: true, departmentId: { in: await departmentIdsFor(userId) } };

  const rows = await prisma.messageTemplate.findMany({
    where,
    orderBy: [{ channel: 'asc' }, { name: 'asc' }],
    select: {
      id: true, key: true, name: true, channel: true, category: true,
      subject: true, header: true, body: true, footer: true,
      description: true, usageCount: true,
      department: { select: { name: true } },
    },
  });

  return rows.map((t) => ({
    id: t.id, key: t.key, name: t.name, channel: t.channel, category: t.category,
    subject: t.subject, header: t.header, body: t.body, footer: t.footer,
    description: t.description, usageCount: t.usageCount,
    departmentName: t.department?.name ?? null,
  }));
}

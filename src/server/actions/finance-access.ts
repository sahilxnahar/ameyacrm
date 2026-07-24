'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';

export type FinanceAccessResult = { ok: true; message: string } | { error: string };

/** The two keys that together mean "can see and touch the money". */
const LEDGER_KEYS = ['finance.ledger.view', 'finance.ledger.manage'] as const;

const schema = z.object({
  userId: z.string().min(1),
  canView: z.boolean(),
  canRecord: z.boolean(),
});

/**
 * Appoint (or remove) someone from the finance team.
 *
 * Only a Super Admin may call this. If an Admin could appoint, they could
 * appoint themselves, and the restriction would mean nothing.
 */
export async function setFinanceAccess(input: unknown): Promise<FinanceAccessResult> {
  try {
    const ctx = await ensure('finance.access.manage');
    const d = schema.parse(input);

    const target = await prisma.user.findUnique({
      where: { id: d.userId },
      select: { id: true, name: true, role: true, status: true },
    });
    if (!target) return { error: 'That person no longer exists.' };
    if (target.role === 'SUPER_ADMIN') {
      return { error: `${target.name} is a Super Admin and always has access — there is nothing to change.` };
    }
    if (d.canRecord && !d.canView) {
      return { error: 'Someone who records payments must also be able to see them.' };
    }

    const perms = await prisma.permission.findMany({
      where: { key: { in: [...LEDGER_KEYS] } },
      select: { id: true, key: true },
    });
    if (perms.length !== LEDGER_KEYS.length) {
      return { error: 'The finance permissions are not in the database yet. Redeploy so the seed can run, then try again.' };
    }

    const wanted: Record<string, boolean> = {
      'finance.ledger.view': d.canView,
      'finance.ledger.manage': d.canRecord,
    };

    for (const p of perms) {
      if (wanted[p.key]) {
        await prisma.userPermission.upsert({
          where: { userId_permissionId: { userId: d.userId, permissionId: p.id } },
          update: { effect: 'ALLOW' },
          create: { userId: d.userId, permissionId: p.id, effect: 'ALLOW' },
        });
      } else {
        await prisma.userPermission.deleteMany({ where: { userId: d.userId, permissionId: p.id } });
      }
    }

    const summary = !d.canView
      ? `Removed ${target.name} from finance access`
      : `${target.name} can now ${d.canRecord ? 'see and record' : 'see'} expenses and payments`;

    await writeAudit({
      actorId: ctx.user.id, action: 'UPDATE', entityType: 'User', entityId: d.userId,
      summary: `Finance access — ${summary}`,
    });
    revalidatePath('/admin/finance-access');
    return { ok: true, message: `${summary}.` };
  } catch (e) {
    return toActionError(e);
  }
}

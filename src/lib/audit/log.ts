import 'server-only';
import type { AuditAction, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getClientInfo } from '@/lib/auth/session';

interface AuditInput {
  actorId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  summary?: string;
  diff?: Prisma.InputJsonValue;
}

/**
 * Append-only audit trail. Never throws into the caller — a failed audit write
 * must not break the user action, but it is logged to the server console.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    const info = await getClientInfo();
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? undefined,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        diff: input.diff,
        ipAddress: info.ip ?? undefined,
        userAgent: info.userAgent ?? undefined,
      },
    });
  } catch (err) {
    console.error('[audit] failed to write log entry', err);
  }
}

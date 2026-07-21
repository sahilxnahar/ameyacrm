'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { PROVIDER_BY_KEY } from '@/config/providers';

export type ConnResult = { ok: true; message: string } | { error: string };

/** Forget an external account. Tokens are deleted, not just flagged. */
export async function disconnectProvider(provider: string): Promise<ConnResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const p = PROVIDER_BY_KEY[provider];
    if (!p) return { error: 'Unknown provider.' };

    await prisma.integrationConnection.updateMany({
      where: { provider },
      data: { status: 'DISCONNECTED', accessToken: null, refreshToken: null, expiresAt: null, lastError: null, connectedAt: null },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Integration', entityId: provider, summary: `Disconnected ${p.name}` });
    revalidatePath('/admin/connections');
    return { ok: true, message: `${p.name} disconnected and its tokens deleted.` };
  } catch (e) {
    return toActionError(e);
  }
}

'use server';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { hashToken } from '@/lib/api/token-auth';
import { ensure, toActionError } from './_helpers';

export type TokenResult = { ok: true; token?: string } | { error: string };

/** Create an API token. The plaintext value is returned ONCE and never stored. */
export async function createApiToken(name: string): Promise<TokenResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const clean = String(name || '').trim().slice(0, 60);
    if (clean.length < 2) return { error: 'Give the token a name.' };
    const raw = `ahc_${randomBytes(24).toString('hex')}`;
    const t = await prisma.apiToken.create({ data: { name: clean, prefix: raw.slice(0, 12), tokenHash: hashToken(raw), scopes: ['read'], createdById: ctx.user.id } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'ApiToken', entityId: t.id, summary: `Created API token ${clean}` });
    revalidatePath('/admin/api-tokens');
    return { ok: true, token: raw };
  } catch (err) { return toActionError(err); }
}

export async function revokeApiToken(id: string): Promise<TokenResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    await prisma.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'ApiToken', entityId: id, summary: 'Revoked API token' });
    revalidatePath('/admin/api-tokens');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

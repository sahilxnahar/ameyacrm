import 'server-only';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';

export function hashToken(raw: string): string { return createHash('sha256').update(raw).digest('hex'); }

/** Validate an `Authorization: Bearer <token>` API token. Returns null when invalid/revoked. */
export async function authenticateApiToken(req: Request): Promise<{ tokenId: string; scopes: string[] } | null> {
  const header = req.headers.get('authorization') || '';
  const raw = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!raw) return null;
  try {
    const t = await prisma.apiToken.findUnique({ where: { tokenHash: hashToken(raw) } });
    if (!t || t.revokedAt) return null;
    prisma.apiToken.update({ where: { id: t.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    return { tokenId: t.id, scopes: t.scopes };
  } catch { return null; }
}

import 'server-only';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';

export function hashToken(raw: string): string { return createHash('sha256').update(raw).digest('hex'); }

/** True if the token carries the required scope. Tokens without an explicit scope
 *  are treated as read-only. (F-09) */
export function hasScope(auth: { scopes: string[] } | null, scope: 'read' | 'write'): boolean {
  if (!auth) return false;
  if (scope === 'read') return true; // any valid token may read
  return auth.scopes.includes('write') || auth.scopes.includes('admin');
}

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

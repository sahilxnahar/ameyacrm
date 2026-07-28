import 'server-only';
import { prisma } from '@/lib/db/prisma';

/**
 * Due-diligence expiry watch. Many NOCs and encumbrance certificates carry a
 * validity; a TOWN_PLANNING_APPROVAL or ENCUMBRANCE_CERTIFICATE nearing expiry
 * (or with no explicit validUntil but older than 6 months) is flagged for the
 * liaison team. Non-stop safe — caught, so an un-migrated table yields zero.
 */
export async function getDueDiligenceExpiry(now = new Date()): Promise<{ expiringSoon: number; deepLink: string | null }> {
  try {
    const soon = new Date(now.getTime() + 30 * 864e5);
    const sixMonthsAgo = new Date(now.getTime() - 182 * 864e5);
    const watched = ['TOWN_PLANNING_APPROVAL', 'ENCUMBRANCE_CERTIFICATE'] as const;
    const where = {
      recordType: { in: watched as unknown as string[] as never },
      verificationStatus: { not: 'REJECTED' as const },
      OR: [
        { validUntil: { not: null, lte: soon } },
        { validUntil: null, createdAt: { lt: sixMonthsAgo } },
      ],
    };
    const [expiringSoon, first] = await Promise.all([
      prisma.dueDiligenceRecord.count({ where }),
      prisma.dueDiligenceRecord.findFirst({ where, orderBy: [{ validUntil: 'asc' }, { createdAt: 'asc' }], select: { id: true, authorityName: true } }),
    ]);
    // Deep-link the alert straight to the exact record — the vault expands the
    // right authority and highlights/scrolls the record via these URL params.
    const deepLink = first ? `/due-diligence?authority=${encodeURIComponent(first.authorityName)}&recordId=${first.id}` : null;
    return { expiringSoon, deepLink };
  } catch {
    return { expiringSoon: 0, deepLink: null };
  }
}

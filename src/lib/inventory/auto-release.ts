import 'server-only';
import { prisma } from '@/lib/db/prisma';

/** Release HELD units whose hold has expired back into the available pool. Returns count. Never throws. */
export async function releaseExpiredHolds(): Promise<number> {
  try {
    const res = await prisma.unit.updateMany({
      where: { status: 'HELD', holdUntil: { not: null, lt: new Date() } },
      data: { status: 'AVAILABLE', holdUntil: null, heldForLeadId: null, heldById: null, tokenAmount: null, holdNote: null },
    });
    return res.count;
  } catch {
    return 0;
  }
}

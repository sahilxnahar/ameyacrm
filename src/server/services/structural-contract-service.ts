import 'server-only';
import { prisma } from '@/lib/db/prisma';

/**
 * Structural contract / CLM engine (module #82). Two jobs: expire contracts that
 * have run past their end date (daily worker), and answer the gate question
 * "is this period certified by the independent engineer?" — which the payment
 * action consults before releasing a structural vendor payment. Extend, never
 * fork: the money still lands on Voucher via the existing RA-bill settlement.
 */
export interface StructuralSweep { expired: number; dlpEnded: number }

export async function sweepStructuralContracts(now = new Date()): Promise<StructuralSweep> {
  let expired = 0, dlpEnded = 0;
  try {
    const past = await prisma.structuralContract.updateMany({
      where: { status: 'ACTIVE', endOn: { not: null, lt: now } },
      data: { status: 'EXPIRED' },
    });
    expired = past.count;
  } catch { /* not migrated — skip */ }
  try {
    dlpEnded = await prisma.structuralContract.count({
      where: { defectLiabilityEnd: { not: null, lt: now } },
    });
  } catch { dlpEnded = 0; }
  return { expired, dlpEnded };
}

/**
 * Gate: block a structural vendor payment for a period unless an independent
 * engineer has certified it. Returns { blocked, reason }. If the vendor has no
 * structural contract at all, nothing to block (blocked=false).
 */
export async function structuralCertificationGate(vendorId: string, period: string): Promise<{ blocked: boolean; reason: string }> {
  try {
    const contract = await prisma.structuralContract.findFirst({
      where: { vendorId, status: { in: ['ACTIVE', 'SUSPENDED'] } },
      select: { id: true, title: true },
    });
    if (!contract) return { blocked: false, reason: '' };
    const cert = await prisma.engineerCertification.findUnique({
      where: { contractId_period: { contractId: contract.id, period } },
      select: { isCleared: true },
    });
    if (!cert || !cert.isCleared) {
      return { blocked: true, reason: `Independent-engineer certification for ${period} is not cleared on structural contract "${contract.title}".` };
    }
    return { blocked: false, reason: '' };
  } catch {
    return { blocked: false, reason: '' };
  }
}

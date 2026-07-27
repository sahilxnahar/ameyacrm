import 'server-only';
import { prisma } from '@/lib/db/prisma';

/**
 * The reusable "document gate" for labour vendors. A vendor flagged
 * `requiresLabourCompliance` may not be paid for a month until BOTH the EPF and
 * ESI challans for that month are recorded and VERIFIED.
 */

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export interface ComplianceStatus {
  requires: boolean;
  month: string;
  epf: 'VERIFIED' | 'UPLOADED' | 'PENDING' | 'MISSING';
  esi: 'VERIFIED' | 'UPLOADED' | 'PENDING' | 'MISSING';
  blocked: boolean;      // true = payment must be blocked
  reason: string | null;
}

export async function vendorComplianceStatus(vendorId: string, month: string): Promise<ComplianceStatus> {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { requiresLabourCompliance: true } }).catch(() => null);
  if (!vendor?.requiresLabourCompliance) {
    return { requires: false, month, epf: 'MISSING', esi: 'MISSING', blocked: false, reason: null };
  }
  const docs = await prisma.complianceDoc.findMany({ where: { vendorId, periodMonth: month, kind: { in: ['EPF', 'ESI'] } }, select: { kind: true, status: true } }).catch(() => []);
  const stateOf = (kind: string) => {
    const d = docs.find((x) => x.kind === kind);
    return (d ? (d.status as 'VERIFIED' | 'UPLOADED' | 'PENDING') : 'MISSING');
  };
  const epf = stateOf('EPF');
  const esi = stateOf('ESI');
  const ok = epf === 'VERIFIED' && esi === 'VERIFIED';
  return {
    requires: true, month, epf, esi, blocked: !ok,
    reason: ok ? null : `EPF/ESI for ${month} not verified (EPF: ${epf.toLowerCase()}, ESI: ${esi.toLowerCase()}).`,
  };
}

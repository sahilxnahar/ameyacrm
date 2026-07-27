import 'server-only';
import { prisma } from '@/lib/db/prisma';

/**
 * NCLT / vendor-insolvency monitor (module #87). When a vendor is admitted into
 * CIRP / under a s.14 moratorium with freezeAdvances set, the daily worker
 * deactivates the vendor (isActive=false) so no fresh advance can be raised, and
 * the payment action consults `vendorAdvanceFrozen` before settling. This is the
 * IBC moratorium enforced in code — the worker flags, the money action blocks.
 */
export interface InsolvencySweep { frozen: number }

export async function sweepVendorInsolvency(): Promise<InsolvencySweep> {
  let frozen = 0;
  try {
    const cases = await prisma.vendorInsolvencyCase.findMany({
      where: { stage: { in: ['CIRP_ADMITTED', 'MORATORIUM'] }, freezeAdvances: true },
      select: { vendorId: true },
    });
    for (const c of cases) {
      await prisma.vendor.update({ where: { id: c.vendorId }, data: { isActive: false } }).catch(() => undefined);
      frozen++;
    }
  } catch { /* not migrated — skip */ }
  return { frozen };
}

/** Gate: is this vendor under an active advance-freezing insolvency case? */
export async function vendorAdvanceFrozen(vendorId: string): Promise<{ blocked: boolean; reason: string }> {
  try {
    const open = await prisma.vendorInsolvencyCase.findFirst({
      where: { vendorId, stage: { in: ['CIRP_ADMITTED', 'MORATORIUM'] }, freezeAdvances: true },
      select: { stage: true, cirpRef: true },
    });
    if (open) {
      return { blocked: true, reason: `Vendor is under an IBC ${open.stage === 'MORATORIUM' ? 'moratorium' : 'CIRP'}${open.cirpRef ? ` (${open.cirpRef})` : ''} — advances are frozen.` };
    }
    return { blocked: false, reason: '' };
  } catch {
    return { blocked: false, reason: '' };
  }
}

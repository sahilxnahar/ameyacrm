import { prisma } from '@/lib/db/prisma';

type Prefix = 'TSK' | 'LEAD' | 'MR' | 'BKG' | 'LSE' | 'MNT' | 'RFI';

/**
 * Generate a human-friendly, monotonic reference like TSK-1042 / LSE-5003.
 */
export async function nextReference(prefix: Prefix): Promise<string> {
  const base: Record<Prefix, number> = { TSK: 1000, LEAD: 2000, MR: 3000, BKG: 4000, LSE: 5000, MNT: 6000, RFI: 7000 };
  const counts: Record<Prefix, () => Promise<number>> = {
    TSK: () => prisma.task.count(),
    LEAD: () => prisma.lead.count(),
    MR: () => prisma.materialRequest.count(),
    BKG: () => prisma.booking.count(),
    LSE: () => prisma.lease.count(),
    MNT: () => prisma.maintenanceRequest.count(),
    RFI: () => prisma.rFI.count(),
  };
  const n = base[prefix] + (await counts[prefix]()) + 1;
  return `${prefix}-${n}`;
}

export function docNumber(prefix: 'INV' | 'PO' | 'BILL', seq: number): string {
  return `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;
}

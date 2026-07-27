import 'server-only';
import { prisma } from '@/lib/db/prisma';

/**
 * Certifier portal queue (module #3). A dedicated view for an independent
 * structural engineer (e.g. S.V. Consultants) of what awaits their sign-off —
 * built entirely over the existing EngineerCertification gate (#82) and the RA-bill
 * approval engine. No new tables: the portal is a lens, the gate is the truth.
 */
export interface CertifierItem {
  contractId: string;
  contract: string;
  contractNo: string;
  project: string;
  vendor: string;
  period: string;      // the month awaiting certification (YYYY-MM)
  held: boolean;       // an explicit held (isCleared=false) record exists
}

function monthKey(d: Date): string { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }

export async function getCertifierQueue(now = new Date()): Promise<{ items: CertifierItem[]; pendingRaBills: number }> {
  const month = monthKey(now);
  let items: CertifierItem[] = [];
  try {
    const contracts = await prisma.structuralContract.findMany({
      where: { status: { in: ['ACTIVE', 'SUSPENDED'] } },
      select: { id: true, title: true, contractNo: true, project: { select: { name: true } }, vendor: { select: { name: true } }, certs: { where: { period: month }, select: { isCleared: true } } },
      take: 300,
    });
    items = contracts
      .filter((c) => !(c.certs[0]?.isCleared))
      .map((c) => ({
        contractId: c.id, contract: c.title, contractNo: c.contractNo,
        project: c.project?.name ?? '—', vendor: c.vendor?.name ?? '—',
        period: month, held: c.certs.length > 0 && !c.certs[0]?.isCleared,
      }));
  } catch { items = []; }

  let pendingRaBills = 0;
  try {
    // RA bills submitted for certification but not yet certified (the approval engine).
    pendingRaBills = await prisma.raBill.count({ where: { status: 'PENDING' } }).catch(() => 0);
  } catch { pendingRaBills = 0; }

  return { items, pendingRaBills };
}

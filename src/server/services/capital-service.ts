import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { escrowPosition, covenantStatus, type EscrowMovementInput, type EscrowPosition, type CovenantStatus } from '@/lib/capital/escrow';

const num = (d: unknown): number => (d == null ? 0 : Number(d));
const numN = (d: unknown): number | null => (d == null ? null : Number(d));

export interface InvestorRow {
  id: string; name: string; contact: string | null; commitment: number;
  drawn: number; distributed: number; unitsAllotted: number; outstanding: number;
}
export interface CapitalRow { id: string; kind: string; source: string; amount: number; costPct: number | null }
export interface CovenantRow extends CovenantStatus { id: string; unit: string | null }

export interface CapitalOverview {
  projectId: string | null;
  investors: InvestorRow[];
  totalCommitment: number;
  totalDrawn: number;
  stack: CapitalRow[];
  stackTotal: number;
  escrow: EscrowPosition;
  latestCertifiedPct: number;
  covenants: CovenantRow[];
  breachedCovenants: number;
}

/** Money received from buyers for a project (or all): posted receipt vouchers. */
async function buyerReceipts(projectId: string | null): Promise<number> {
  const rows = await prisma.voucher.findMany({
    where: { status: 'POSTED', kind: { in: ['CASH_RECEIVED', 'BANK_RECEIVED'] }, ...(projectId ? { projectId } : {}) },
    select: { amount: true },
  });
  return rows.reduce((s, v) => s + num(v.amount), 0);
}

export async function capitalOverview(projectId: string | null): Promise<CapitalOverview> {
  const where = projectId ? { projectId } : {};

  const [investors, stack, escrowRows, covenants, receipts] = await Promise.all([
    prisma.investor.findMany({ where, orderBy: { name: 'asc' }, include: { transactions: { select: { kind: true, amount: true, unitsAllotted: true } } } }),
    prisma.capitalStackEntry.findMany({ where, orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }] }),
    prisma.escrowMovement.findMany({ where, orderBy: { movementDate: 'asc' } }),
    prisma.loanCovenant.findMany({ where, orderBy: { createdAt: 'asc' } }),
    buyerReceipts(projectId),
  ]);

  const investorRows: InvestorRow[] = investors.map((inv) => {
    let drawn = 0, distributed = 0, units = 0;
    for (const t of inv.transactions) {
      const a = num(t.amount);
      if (t.kind === 'DRAWDOWN') { drawn += a; units += t.unitsAllotted ?? 0; }
      else if (t.kind === 'DISTRIBUTION') distributed += a;
      else if (t.kind === 'REPAYMENT') distributed += a;
    }
    return { id: inv.id, name: inv.name, contact: inv.contact, commitment: num(inv.commitment), drawn, distributed, unitsAllotted: units, outstanding: num(inv.commitment) - drawn };
  });

  // Certified progress: the latest certifiedPct recorded on an escrow withdrawal,
  // else 0. (A dedicated certificate record is a later batch; this reuses the
  // evidence already captured against withdrawals.)
  const latestCertifiedPct = escrowRows
    .filter((m) => m.certifiedPct != null)
    .reduce((max, m) => Math.max(max, num(m.certifiedPct)), 0);

  const movements: EscrowMovementInput[] = escrowRows.map((m) => ({ kind: m.kind, amount: num(m.amount) }));
  const escrow = escrowPosition(receipts, movements, latestCertifiedPct);

  const covRows: CovenantRow[] = covenants.map((c) => ({
    ...covenantStatus({ name: c.name, direction: c.direction, threshold: num(c.threshold), current: num(c.current) }),
    id: c.id, unit: c.unit,
  }));

  return {
    projectId,
    investors: investorRows,
    totalCommitment: investorRows.reduce((s, i) => s + i.commitment, 0),
    totalDrawn: investorRows.reduce((s, i) => s + i.drawn, 0),
    stack: stack.map((e) => ({ id: e.id, kind: e.kind, source: e.source, amount: num(e.amount), costPct: numN(e.costPct) })),
    stackTotal: stack.reduce((s, e) => s + num(e.amount), 0),
    escrow,
    latestCertifiedPct,
    covenants: covRows,
    breachedCovenants: covRows.filter((c) => c.breached).length,
  };
}

export async function currentEscrowPosition(projectId: string | null): Promise<EscrowPosition> {
  const [escrowRows, receipts] = await Promise.all([
    prisma.escrowMovement.findMany({ where: projectId ? { projectId } : {}, select: { kind: true, amount: true, certifiedPct: true } }),
    buyerReceipts(projectId),
  ]);
  const certified = escrowRows.filter((m) => m.certifiedPct != null).reduce((mx, m) => Math.max(mx, num(m.certifiedPct)), 0);
  return escrowPosition(receipts, escrowRows.map((m) => ({ kind: m.kind, amount: num(m.amount) })), certified);
}

import 'server-only';
import { prisma } from '@/lib/db/prisma';

export interface HomeLoanRow {
  id: string;
  buyerName: string;
  bankName: string;
  applicationRef: string | null;
  loanAmount: number;
  sanctionedAmount: number | null;
  disbursedAmount: number;
  status: string;
  nocIssued: boolean;
  tripartiteSigned: boolean;
  sanctionDate: string | null;
  notes: string | null;
  customerId: string | null;
}

export interface HomeLoanSummary {
  count: number;
  sanctionedTotal: number;
  disbursedTotal: number;
  pendingNoc: number;
  pendingTripartite: number;
}

const n = (d: unknown) => (d == null ? 0 : Number(d));

export async function listHomeLoans(projectId: string | null): Promise<{ loans: HomeLoanRow[]; summary: HomeLoanSummary }> {
  const rows = await prisma.homeLoan.findMany({
    where: projectId ? { projectId } : {},
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });
  const loans: HomeLoanRow[] = rows.map((r) => ({
    id: r.id,
    buyerName: r.buyerName,
    bankName: r.bankName,
    applicationRef: r.applicationRef,
    loanAmount: n(r.loanAmount),
    sanctionedAmount: r.sanctionedAmount == null ? null : n(r.sanctionedAmount),
    disbursedAmount: n(r.disbursedAmount),
    status: r.status,
    nocIssued: r.nocIssued,
    tripartiteSigned: r.tripartiteSigned,
    sanctionDate: r.sanctionDate ? r.sanctionDate.toISOString() : null,
    notes: r.notes,
    customerId: r.customerId,
  }));
  const active = loans.filter((l) => l.status !== 'REJECTED');
  const summary: HomeLoanSummary = {
    count: loans.length,
    sanctionedTotal: active.reduce((s, l) => s + (l.sanctionedAmount ?? 0), 0),
    disbursedTotal: active.reduce((s, l) => s + l.disbursedAmount, 0),
    pendingNoc: active.filter((l) => !l.nocIssued && (l.status === 'SANCTIONED' || l.status.startsWith('DISBURSED'))).length,
    pendingTripartite: active.filter((l) => !l.tripartiteSigned && (l.status === 'SANCTIONED' || l.status.startsWith('DISBURSED'))).length,
  };
  return { loans, summary };
}

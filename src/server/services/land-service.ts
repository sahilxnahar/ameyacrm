import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { analyseTitleChain, type ChainLink, type TitleChainAnalysis } from '@/lib/land/title-chain';
import { sanctionHealth, summariseSanctions, type SanctionInput, type SanctionSummary } from '@/lib/land/approvals';

/**
 * Everything the Land & Approvals screen needs, assembled server-side so the
 * client is handed plain, serializable data. Prisma Decimals become numbers
 * here — a Decimal cannot cross the server/client boundary intact, and rupee
 * amounts on this screen are display figures, not ledger postings.
 */

const num = (d: unknown): number | null => (d == null ? null : Number(d));

export interface ParcelWithTitle {
  id: string;
  name: string;
  projectId: string | null;
  surveyNumber: string | null;
  village: string | null;
  district: string | null;
  state: string;
  extentAcre: number | null;
  ownerName: string | null;
  askingRate: number | null;
  agreedRate: number | null;
  stage: string;
  title: TitleChainAnalysis;
  jdaCount: number;
  revenueCount: number;
  approvalCount: number;
}

export async function listParcels(projectId?: string | null): Promise<ParcelWithTitle[]> {
  const parcels = await prisma.landParcel.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: [{ stage: 'asc' }, { createdAt: 'desc' }],
    include: {
      titleDocuments: true,
      _count: { select: { jdas: true, revenueRecords: true, approvals: true } },
    },
  });

  return parcels.map((p) => {
    const links: ChainLink[] = p.titleDocuments.map((d) => ({
      id: d.id,
      kind: d.kind,
      title: d.title,
      chainOrder: d.chainOrder,
      fromParty: d.fromParty,
      toParty: d.toParty,
      verified: d.verified,
    }));
    return {
      id: p.id,
      name: p.name,
      projectId: p.projectId,
      surveyNumber: p.surveyNumber,
      village: p.village,
      district: p.district,
      state: p.state,
      extentAcre: num(p.extentAcre),
      ownerName: p.ownerName,
      askingRate: num(p.askingRate),
      agreedRate: num(p.agreedRate),
      stage: p.stage,
      title: analyseTitleChain(links),
      jdaCount: p._count.jdas,
      revenueCount: p._count.revenueRecords,
      approvalCount: p._count.approvals,
    };
  });
}

export interface ApprovalRow {
  id: string;
  authority: string;
  name: string;
  status: string;
  parcelId: string | null;
  projectId: string | null;
  appliedOn: Date | null;
  expectedOn: Date | null;
  approvedOn: Date | null;
  expiresOn: Date | null;
  feePaid: number | null;
  currentDesk: string | null;
  referenceNo: string | null;
  overdue: boolean;
  daysOverdue: number;
  expiringSoon: boolean;
  expired: boolean;
  daysToExpiry: number | null;
  liaisonCount: number;
}

export async function listApprovals(
  now: Date,
  projectId?: string | null,
): Promise<{ rows: ApprovalRow[]; summary: SanctionSummary }> {
  const items = await prisma.approvalSanction.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: [{ status: 'asc' }, { expectedOn: 'asc' }],
    include: { _count: { select: { liaisonLogs: true } } },
  });

  const forSummary: SanctionInput[] = items.map((a) => ({
    id: a.id,
    authority: a.authority,
    name: a.name,
    status: a.status,
    expectedOn: a.expectedOn,
    expiresOn: a.expiresOn,
    approvedOn: a.approvedOn,
  }));

  const rows: ApprovalRow[] = items.map((a) => {
    const h = sanctionHealth(
      { id: a.id, authority: a.authority, name: a.name, status: a.status, expectedOn: a.expectedOn, expiresOn: a.expiresOn, approvedOn: a.approvedOn },
      now,
    );
    return {
      id: a.id,
      authority: a.authority,
      name: a.name,
      status: a.status,
      parcelId: a.parcelId,
      projectId: a.projectId,
      appliedOn: a.appliedOn,
      expectedOn: a.expectedOn,
      approvedOn: a.approvedOn,
      expiresOn: a.expiresOn,
      feePaid: num(a.feePaid),
      currentDesk: a.currentDesk,
      referenceNo: a.referenceNo,
      overdue: h.overdue,
      daysOverdue: h.daysOverdue,
      expiringSoon: h.expiringSoon,
      expired: h.expired,
      daysToExpiry: h.daysToExpiry,
      liaisonCount: a._count.liaisonLogs,
    };
  });

  return { rows, summary: summariseSanctions(forSummary, now) };
}

export interface LitigationRow {
  id: string;
  title: string;
  court: string | null;
  caseNumber: string | null;
  counsel: string | null;
  status: string;
  nextHearing: Date | null;
  exposure: number | null;
  projectId: string | null;
}

export async function listLitigation(projectId?: string | null): Promise<LitigationRow[]> {
  const items = await prisma.litigationMatter.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: [{ status: 'asc' }, { nextHearing: 'asc' }],
  });
  return items.map((m) => ({
    id: m.id,
    title: m.title,
    court: m.court,
    caseNumber: m.caseNumber,
    counsel: m.counsel,
    status: m.status,
    nextHearing: m.nextHearing,
    exposure: num(m.exposure),
    projectId: m.projectId,
  }));
}

export interface LandOverview {
  parcels: ParcelWithTitle[];
  approvals: ApprovalRow[];
  approvalSummary: SanctionSummary;
  litigation: LitigationRow[];
  parcelsWithGaps: number;
}

/** One call for the page: parcels, approvals and litigation for a project (or all). */
export async function landOverview(now: Date, projectId?: string | null): Promise<LandOverview> {
  const [parcels, approvals, litigation] = await Promise.all([
    listParcels(projectId),
    listApprovals(now, projectId),
    listLitigation(projectId),
  ]);
  return {
    parcels,
    approvals: approvals.rows,
    approvalSummary: approvals.summary,
    litigation,
    parcelsWithGaps: parcels.filter((p) => p.title.gaps.length > 0).length,
  };
}

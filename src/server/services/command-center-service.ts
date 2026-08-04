import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';
import { ocRisk } from '@/lib/planning/far';
import { getWelfareCompliance } from '@/server/services/welfare-service';
import { getDueDiligenceExpiry } from '@/server/services/due-diligence-service';

/**
 * Command-Center aggregation (new UI, Bento dashboard). One cheap parallel sweep
 * that surfaces the *urgent* signal from every operational engine built into the
 * ERP — MSME clocks, dunning, sign-offs, insolvency freezes, renewals, the webhook
 * queue. Non-stop by construction: every count is independently caught, so a
 * single un-migrated table (feature not yet rolled out) yields 0, never a crash.
 */
export interface AlertTile {
  key: string;
  label: string;
  value: number;
  href: string;
  tone: 'default' | 'success' | 'warning' | 'destructive';
  hint: string;
}

async function safe(fn: () => Promise<number>): Promise<number> {
  try { return await fn(); } catch { return 0; }
}

/**
 * Every operational count the dashboard needs, gathered once.
 *
 * ── Why this is one function ────────────────────────────────────────────────
 *
 * `getCommandCenter` and `getLaunchpadBadges` were written independently and
 * the page awaits both. Eleven of the counts were identical, so the dashboard
 * asked the database the same eleven questions twice — 35 round-trips measured
 * for one load. Now 21 — measured, both numbers, by tests/query-cost.test.ts.
 *
 * The duplication also produced a subtler problem than cost. Two counts taken a
 * few milliseconds apart, either side of a write, disagree — so the same screen
 * could show "MSME overdue 3" on the tile and a finance badge computed from 2.
 * Nobody would call that a race condition; they would call it a bug in the data,
 * and go looking in the wrong place.
 *
 * Wrapped in React `cache()`, which is the pattern already used by
 * company-service, department-service and the rest: within one request the
 * second caller gets the first caller's result, at no cost and with no risk of
 * staleness across requests.
 *
 * `cache()` is the belt, not the braces. It only dedupes inside a React render
 * scope — measured: two getters called from plain Node ran the sweep twice, for
 * 42 round-trips, WORSE than the 35 they cost before being merged. So the page
 * calls `getDashboard()` below, which sweeps once by construction, and the
 * dedupe is a bonus for anything else that happens to ask during the same render.
 */
const operationalCounts = cache(async () => {
  const now = Date.now();
  const soon = new Date(now + 7 * 864e5);

  const [
    msmeOverdue, demandsPending, insolvencyFrozen, tmRenewal, femaDue,
    hearings, certPending, webhookPending, webhookFailed, estampPending,
    blacklisted, uanInvalid, gstrIssues, materialPending, approvalsPending,
  ] = await Promise.all([
    safe(() => prisma.msmePaymentClock.count({ where: { status: { in: ['OVERDUE', 'DISALLOWED'] } } })),
    safe(() => prisma.demandNotice.count({ where: { status: 'PENDING' } })),
    safe(() => prisma.vendorInsolvencyCase.count({ where: { stage: { in: ['CIRP_ADMITTED', 'MORATORIUM'] }, freezeAdvances: true } })),
    safe(() => prisma.trademark.count({ where: { status: 'RENEWAL_DUE' } })),
    safe(() => prisma.foreignRemittance.count({ where: { reportedOn: null, reportDueOn: { not: null, lte: new Date(now + 30 * 864e5) } } })),
    safe(async () => {
      const [a, l] = await Promise.all([
        prisma.adrCase.count({ where: { nextHearingOn: { not: null, lte: soon }, stage: { notIn: ['SETTLED', 'CLOSED'] } } }),
        prisma.litigationEscalation.count({ where: { nextHearingOn: { not: null, lte: soon }, status: { not: 'DISPOSED' } } }),
      ]);
      return a + l;
    }),
    safe(() => prisma.engineerCertification.count({ where: { isCleared: false } })),
    safe(() => prisma.webhookEvent.count({ where: { status: 'PENDING' } })),
    safe(() => prisma.webhookEvent.count({ where: { status: 'FAILED' } })),
    safe(() => prisma.estampCertificate.count({ where: { status: 'REQUESTED' } })),
    safe(() => prisma.vendorDefault.count({ where: { severity: 'BLACKLIST' } })),
    safe(() => prisma.labourUan.count({ where: { status: 'INVALID' } })),
    safe(() => prisma.gstr2bLine.count({ where: { status: { in: ['MISMATCH_AMOUNT', 'MISSING_IN_2B'] } } })),
    safe(() => prisma.materialRequest.count({ where: { status: 'SUBMITTED' } })),
    safe(() => prisma.approvalRequest.count({ where: { status: 'PENDING' } })),
  ]);

  // The three that need a compute rather than a count. They used to run in
  // series after the sweep; there is no reason for that, so they join it.
  const [ocAtRisk, welfareGaps, dd] = await Promise.all([
    safe(async () => {
      const rows = await prisma.planSanction.findMany({ where: { ocReceived: false }, select: { sanctionedFar: true, builtFar: true } });
      return rows.filter((r) => ocRisk(Number(r.sanctionedFar), Number(r.builtFar)) === 'AT_RISK').length;
    }),
    safe(async () => (await getWelfareCompliance()).gapCount),
    getDueDiligenceExpiry().catch(() => ({ expiringSoon: 0, deepLink: null as string | null })),
  ]);

  return {
    msmeOverdue, demandsPending, insolvencyFrozen, tmRenewal, femaDue,
    hearings, certPending, webhookPending, webhookFailed, estampPending,
    blacklisted, uanInvalid, gstrIssues, materialPending, approvalsPending,
    ocAtRisk, welfareGaps, ddExpiring: dd.expiringSoon, ddDeepLink: dd.deepLink,
  };
});

type Counts = Awaited<ReturnType<typeof operationalCounts>>;

export async function getCommandCenter(): Promise<{ tiles: AlertTile[]; urgent: number }> {
  return buildCommandCenter(await operationalCounts());
}

function buildCommandCenter(counts: Counts): { tiles: AlertTile[]; urgent: number } {
  const {
    msmeOverdue, demandsPending, insolvencyFrozen, tmRenewal, femaDue,
    hearings, certPending, webhookPending, webhookFailed, estampPending,
    blacklisted, uanInvalid, gstrIssues, ocAtRisk, welfareGaps,
    ddExpiring, ddDeepLink,
  } = counts;

  const tiles: AlertTile[] = [
    { key: 'msme', label: 'MSME overdue', value: msmeOverdue, href: '/msme-tracker', tone: msmeOverdue ? 'destructive' : 'success', hint: 'S.43B(h) tax-disallowance risk' },
    { key: 'certs', label: 'Sign-offs pending', value: certPending, href: '/certifier-portal', tone: certPending ? 'warning' : 'success', hint: 'Independent-engineer certifications' },
    { key: 'demands', label: 'Demands to send', value: demandsPending, href: '/demands', tone: demandsPending ? 'warning' : 'success', hint: 'Buyer instalment reminders queued' },
    { key: 'insolvency', label: 'Vendors frozen', value: insolvencyFrozen, href: '/vendor-insolvency', tone: insolvencyFrozen ? 'destructive' : 'success', hint: 'IBC moratorium — advances blocked' },
    { key: 'far', label: 'OC at risk', value: ocAtRisk, href: '/plan-sanction', tone: ocAtRisk ? 'destructive' : 'success', hint: 'FAR deviation over tolerance' },
    { key: 'welfare', label: 'BOCW gaps', value: welfareGaps, href: '/welfare-log', tone: welfareGaps ? 'destructive' : 'success', hint: 'Welfare facilities unlogged this month' },
    { key: 'duediligence', label: 'DD expiring', value: ddExpiring, href: ddDeepLink ?? '/due-diligence', tone: ddExpiring ? 'warning' : 'success', hint: 'NOC / EC nearing expiry' },
    { key: 'tm', label: 'Trademark renewals', value: tmRenewal, href: '/ip-registry', tone: tmRenewal ? 'warning' : 'success', hint: '10-year TM renewal approaching' },
    { key: 'fema', label: 'FEMA reports due', value: femaDue, href: '/nri-gateway', tone: femaDue ? 'warning' : 'success', hint: '90-day inward-remittance reporting' },
    { key: 'hearings', label: 'Hearings ≤7d', value: hearings, href: '/appellate-litigation', tone: hearings ? 'warning' : 'success', hint: 'Arbitration + court listings' },
    { key: 'blacklist', label: 'Blacklisted vendors', value: blacklisted, href: '/vendor-registry', tone: blacklisted ? 'destructive' : 'success', hint: 'Defaulters deactivated across projects' },
    { key: 'uan', label: 'Invalid UANs', value: uanInvalid, href: '/uan-validator', tone: uanInvalid ? 'destructive' : 'success', hint: 'EPF/ESI check failed at the gate' },
    { key: 'gstr', label: 'GSTR-2B issues', value: gstrIssues, href: '/gstr-recon', tone: gstrIssues ? 'destructive' : 'success', hint: 'Invoice mismatch / missing before ITC' },
    { key: 'estamp', label: 'e-Stamps pending', value: estampPending, href: '/estamps', tone: estampPending ? 'warning' : 'default', hint: 'Awaiting SHCIL issuance' },
    { key: 'queue', label: 'Webhook queue', value: webhookPending, href: '/admin/integration-events', tone: webhookPending ? 'warning' : 'success', hint: 'Async events awaiting processing' },
    { key: 'deadletter', label: 'Failed events', value: webhookFailed, href: '/admin/integration-events', tone: webhookFailed ? 'destructive' : 'success', hint: 'Dead-lettered — need replay' },
  ];

  const urgent = tiles.filter((t) => t.tone === 'destructive').reduce((n, t) => n + t.value, 0);
  return { tiles, urgent };
}

/**
 * Per-app badge rollups for the Ameya OS Launchpad's Core 8 cards. Keyed by the
 * Launchpad app id.
 *
 * Reads the same sweep the alert tiles read, so the badge on the Finance card
 * and the MSME tile always tell the same story — and the page pays for the
 * counts once.
 */
export type LaunchpadBadges = Record<
  'finance' | 'siteops' | 'legal' | 'vendor' | 'sales' | 'procurement' | 'approvals' | 'settings',
  number
>;

export async function getLaunchpadBadges(): Promise<LaunchpadBadges> {
  return buildBadges(await operationalCounts());
}

function buildBadges(counts: Counts): LaunchpadBadges {
  const {
    msmeOverdue, gstrIssues, certPending, welfareGaps, uanInvalid, blacklisted,
    demandsPending, materialPending, approvalsPending, webhookFailed,
    tmRenewal, hearings, ddExpiring,
  } = counts;

  return {
    finance: msmeOverdue + gstrIssues,
    siteops: certPending,
    legal: ddExpiring + tmRenewal + hearings,
    vendor: welfareGaps + uanInvalid + blacklisted,
    sales: demandsPending,
    procurement: materialPending,
    approvals: approvalsPending,
    settings: webhookFailed,
  };
}

/**
 * Everything the Command Centre page renders, from one sweep.
 *
 * This is what the page should call. `getCommandCenter` and `getLaunchpadBadges`
 * remain for callers that genuinely want only one half — but awaiting both, as
 * the page used to, is the case this exists to make cheap.
 */
export async function getDashboard(): Promise<{
  tiles: AlertTile[];
  urgent: number;
  badges: LaunchpadBadges;
}> {
  const counts = await operationalCounts();
  return { ...buildCommandCenter(counts), badges: buildBadges(counts) };
}

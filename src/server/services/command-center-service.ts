import 'server-only';
import { prisma } from '@/lib/db/prisma';

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

export async function getCommandCenter(): Promise<{ tiles: AlertTile[]; urgent: number }> {
  const [
    msmeOverdue, demandsPending, insolvencyFrozen, tmRenewal, femaDue,
    hearings, certPending, webhookPending, webhookFailed, estampPending,
  ] = await Promise.all([
    safe(() => prisma.msmePaymentClock.count({ where: { status: { in: ['OVERDUE', 'DISALLOWED'] } } })),
    safe(() => prisma.demandNotice.count({ where: { status: 'PENDING' } })),
    safe(() => prisma.vendorInsolvencyCase.count({ where: { stage: { in: ['CIRP_ADMITTED', 'MORATORIUM'] }, freezeAdvances: true } })),
    safe(() => prisma.trademark.count({ where: { status: 'RENEWAL_DUE' } })),
    safe(() => prisma.foreignRemittance.count({ where: { reportedOn: null, reportDueOn: { not: null, lte: new Date(Date.now() + 30 * 864e5) } } })),
    safe(async () => {
      const soon = new Date(Date.now() + 7 * 864e5);
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
  ]);

  const tiles: AlertTile[] = [
    { key: 'msme', label: 'MSME overdue', value: msmeOverdue, href: '/msme-tracker', tone: msmeOverdue ? 'destructive' : 'success', hint: 'S.43B(h) tax-disallowance risk' },
    { key: 'certs', label: 'Sign-offs pending', value: certPending, href: '/structural-contracts', tone: certPending ? 'warning' : 'success', hint: 'Independent-engineer certifications' },
    { key: 'demands', label: 'Demands to send', value: demandsPending, href: '/demands', tone: demandsPending ? 'warning' : 'success', hint: 'Buyer instalment reminders queued' },
    { key: 'insolvency', label: 'Vendors frozen', value: insolvencyFrozen, href: '/vendor-insolvency', tone: insolvencyFrozen ? 'destructive' : 'success', hint: 'IBC moratorium — advances blocked' },
    { key: 'tm', label: 'Trademark renewals', value: tmRenewal, href: '/ip-registry', tone: tmRenewal ? 'warning' : 'success', hint: '10-year TM renewal approaching' },
    { key: 'fema', label: 'FEMA reports due', value: femaDue, href: '/nri-gateway', tone: femaDue ? 'warning' : 'success', hint: '90-day inward-remittance reporting' },
    { key: 'hearings', label: 'Hearings ≤7d', value: hearings, href: '/appellate-litigation', tone: hearings ? 'warning' : 'success', hint: 'Arbitration + court listings' },
    { key: 'estamp', label: 'e-Stamps pending', value: estampPending, href: '/estamps', tone: estampPending ? 'warning' : 'default', hint: 'Awaiting SHCIL issuance' },
    { key: 'queue', label: 'Webhook queue', value: webhookPending, href: '/admin/integration-events', tone: webhookPending ? 'warning' : 'success', hint: 'Async events awaiting processing' },
    { key: 'deadletter', label: 'Failed events', value: webhookFailed, href: '/admin/integration-events', tone: webhookFailed ? 'destructive' : 'success', hint: 'Dead-lettered — need replay' },
  ];

  const urgent = tiles.filter((t) => t.tone === 'destructive').reduce((n, t) => n + t.value, 0);
  return { tiles, urgent };
}

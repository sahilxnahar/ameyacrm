import 'server-only';
import { prisma } from '@/lib/db/prisma';
import type { DocketMatter, LitigationDocket, RenewalRow, RenewalState, DocRenewals } from '@/lib/legal/types';

export type { HearingRow, DocketMatter, LitigationDocket, RenewalState, RenewalRow, DocRenewals } from '@/lib/legal/types';

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const num = (d: unknown) => (d == null ? null : Number(d));

export async function getLitigationDocket(projectId?: string | null): Promise<LitigationDocket> {
  const projects = await prisma.project.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
  const pid = projectId ?? null;
  const items = await prisma.litigationMatter.findMany({
    where: pid ? { projectId: pid } : undefined,
    orderBy: [{ status: 'asc' }, { nextHearing: 'asc' }],
    include: { hearings: { orderBy: { date: 'desc' } } },
    take: 1000,
  });
  const matters: DocketMatter[] = items.map((m) => ({
    id: m.id, title: m.title, court: m.court, caseNumber: m.caseNumber, counsel: m.counsel,
    status: m.status, nextHearing: iso(m.nextHearing), exposure: num(m.exposure), summary: m.summary, projectId: m.projectId,
    hearings: m.hearings.map((h) => ({ id: h.id, date: h.date.toISOString(), purpose: h.purpose, outcome: h.outcome, nextDate: iso(h.nextDate), notes: h.notes })),
  }));
  return { matters, projects, projectId: pid };
}

const SOON_DAYS = 60;
const DAY = 86400000;
const RENEWABLE_KINDS = ['ENCUMBRANCE_CERTIFICATE', 'KHATA'];
const ORDER: Record<RenewalState, number> = { expired: 0, soon: 1, untracked: 2, ok: 3 };

/**
 * EC / Khata (and any title doc already given an expiry) with renewal status —
 * flagged expired / expiring soon, plus the ones not yet being tracked.
 */
export async function getDocRenewals(now: Date): Promise<DocRenewals> {
  const docs = await prisma.titleDocument.findMany({
    where: { OR: [{ kind: { in: RENEWABLE_KINDS as never } }, { expiresOn: { not: null } }] },
    include: { parcel: { select: { name: true, surveyNumber: true } } },
    take: 3000,
  });
  let expired = 0, soon = 0, tracked = 0;
  const rows: RenewalRow[] = docs.map((d) => {
    const parcelName = d.parcel.surveyNumber ? `${d.parcel.name} (Sy. ${d.parcel.surveyNumber})` : d.parcel.name;
    if (!d.expiresOn) return { id: d.id, parcelId: d.parcelId, parcelName, kind: d.kind, title: d.title, expiresOn: null, daysToExpiry: null, state: 'untracked' as RenewalState, renewalNote: d.renewalNote };
    tracked++;
    const exp = d.expiresOn;
    const days = Math.ceil((exp.getTime() - now.getTime()) / DAY);
    const state: RenewalState = days < 0 ? 'expired' : days <= SOON_DAYS ? 'soon' : 'ok';
    if (state === 'expired') expired++; else if (state === 'soon') soon++;
    return { id: d.id, parcelId: d.parcelId, parcelName, kind: d.kind, title: d.title, expiresOn: exp.toISOString(), daysToExpiry: days, state, renewalNote: d.renewalNote };
  });
  rows.sort((a, b) => ORDER[a.state] - ORDER[b.state] || (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999'));
  return { rows, expired, soon, tracked, total: rows.length };
}

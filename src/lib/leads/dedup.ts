import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { normalizePhone } from '@/server/services/duplicate-service';

/** How long a closed lead stays "the same enquiry" before a fresh approach counts as new business. */
export const REOPEN_WINDOW_DAYS = 120;

export interface DuplicateMatch {
  id: string;
  ownerId: string | null;
  reference: string;
  name: string;
  status: string;
  /** True when the match was closed (WON/LOST) or has gone quiet for a long time. */
  stale: boolean;
}

/**
 * Find an existing lead matching this phone or email — the core of commission
 * protection, and the gate every capture path passes through.
 *
 * Two things this deliberately changed, because both were losing business:
 *
 *  1. It no longer matches on the raw phone string. Somebody who types
 *     "9840490000" on the website and arrives from Meta as "+91 98404 90000" is
 *     one person; comparing the text made them two leads, two owners, and two
 *     reps ringing the same buyer. Matching now uses the last ten digits — the
 *     same rule the duplicates report already applied.
 *
 *  2. It no longer returns the OLDEST match. Handing back a lead marked LOST
 *     fourteen months ago meant a fresh enquiry became a note on a dead record,
 *     and LOST leads are excluded from both the follow-up sweep and Today, so
 *     nobody was ever told. An open match is preferred; when the only match is
 *     closed or long-quiet it comes back flagged `stale` so the caller can
 *     reopen it instead of filing the enquiry away.
 */
export async function findDuplicateLead(phone: string | null, email: string | null): Promise<DuplicateMatch | null> {
  const key = normalizePhone(phone);
  const mail = email?.trim().toLowerCase() || null;
  if (!key && !mail) return null;

  // Phone is stored as entered, so a last-10-digit comparison cannot be plain
  // SQL equality. Candidates are narrowed with a suffix match and confirmed in
  // JS; the cap keeps that bounded.
  const candidates = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      OR: [
        ...(key ? [{ phone: { contains: key } }] : []),
        ...(mail ? [{ email: { equals: mail, mode: 'insensitive' as const } }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, ownerId: true, reference: true, name: true, status: true, updatedAt: true, phone: true, email: true },
  });

  // Confirm the phone match on normalised digits — `contains` can match a
  // longer number that merely ends with the same ten digits.
  const confirmed = candidates.filter((c) => {
    const phoneHit = key ? normalizePhone(c.phone) === key : false;
    const mailHit = mail ? (c.email ?? '').trim().toLowerCase() === mail : false;
    return phoneHit || mailHit;
  });
  if (confirmed.length === 0) return null;

  const open = confirmed.find((c) => c.status !== 'WON' && c.status !== 'LOST');
  const chosen = open ?? confirmed[0]!;
  const cutoff = new Date(Date.now() - REOPEN_WINDOW_DAYS * 86400_000);
  const stale = chosen.status === 'WON' || chosen.status === 'LOST' || chosen.updatedAt < cutoff;

  return {
    id: chosen.id, ownerId: chosen.ownerId, reference: chosen.reference,
    name: chosen.name, status: chosen.status, stale,
  };
}

/**
 * A repeat enquiry against a lead that was closed or had gone quiet.
 *
 * Puts it back in play — status reopened, follow-up set for today — and tells
 * the owner, or the sales managers when it has no owner. Without this the
 * enquiry lands as a note on a record that appears in nobody's queue.
 */
export async function reopenStaleLead(leadId: string, why: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { ownerId: true, name: true, reference: true },
  }).catch(() => null);
  if (!lead) return;

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: 'CONTACTED', nextFollowUp: new Date() },
  }).catch(() => undefined);

  const { notify, notifyMany } = await import('@/lib/notifications/notify');
  const body = `${lead.name} (${lead.reference}) has come back: ${why}. The lead was closed or had gone quiet, so it has been reopened and set for follow-up today.`;

  if (lead.ownerId) {
    await notify({
      userId: lead.ownerId, type: 'SYSTEM', title: `${lead.name} enquired again`,
      body, link: `/sales/${leadId}`,
    }).catch(() => undefined);
    return;
  }

  const managers = await prisma.user.findMany({
    where: { status: 'ACTIVE', deletedAt: null, role: { in: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'MANAGER'] } },
    select: { id: true }, take: 10,
  }).catch(() => []);
  await notifyMany(managers.map((m) => m.id), {
    type: 'SYSTEM', title: `${lead.name} enquired again — nobody owns this lead`,
    body, link: `/sales/${leadId}`,
  }).catch(() => undefined);
}

import { NextResponse, type NextRequest } from 'next/server';
import type { SocialChannel } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { limitOr429, callerIp } from '@/lib/security/rate-limit';
import { nextReference } from '@/lib/utils/reference';
import { findDuplicateLead } from '@/lib/leads/dedup';
import { announceSocialActivity } from '@/lib/social/notify-social';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Capture social activity from the notification emails the platforms already
 * send you — no Instagram/LinkedIn/Meta API, no developer account, no billing.
 *
 * The Apps Script connector scans the mailbox and posts each matching message
 * here. Auth: INGEST_SECRET.
 */
const SENDER_CHANNEL: Array<[RegExp, SocialChannel]> = [
  [/instagram\.com|mail\.instagram/i, 'INSTAGRAM'],
  [/linkedin\.com/i, 'LINKEDIN'],
  [/facebookmail\.com|facebook\.com|meta\.com/i, 'FACEBOOK'],
  [/twitter\.com|x\.com/i, 'TWITTER'],
  [/youtube\.com|google\.com\/youtube/i, 'YOUTUBE'],
  [/whatsapp\.com/i, 'WHATSAPP'],
  [/google\.com|googleadservices/i, 'GOOGLE'],
];

function channelFor(from: string, subject: string): SocialChannel {
  const hay = `${from} ${subject}`;
  for (const [re, ch] of SENDER_CHANNEL) if (re.test(hay)) return ch;
  return 'OTHER';
}

/** Classify the notification well enough to be useful; Gemini writes the prose. */
function kindFor(subject: string, body: string): string {
  const t = `${subject} ${body}`.toLowerCase();
  if (/new lead|lead form|form submission|enquiry|enquiry received|interested/.test(t)) return 'lead';
  if (/sent you a message|new message|replied to|direct message|inbox/.test(t)) return 'dm';
  if (/commented|comment on/.test(t)) return 'comment';
  if (/mentioned you|tagged you/.test(t)) return 'mention';
  if (/started following|new follower|followed you/.test(t)) return 'follower';
  if (/subscrib/.test(t)) return 'subscriber';
  if (/review|rated/.test(t)) return 'review';
  return 'activity';
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_RE = /(?:\+?91[-\s]?)?[6-9]\d{9}/;

export async function POST(req: NextRequest) {
  const over = await limitOr429(`ingest:social:${await callerIp()}`, 60, 60);
  if (over) return over;

  const secret = env.INGEST_SECRET;
  const key = req.headers.get('x-ingest-key') || req.nextUrl.searchParams.get('key');
  if (!secret || key !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let payload: { messages?: Array<Record<string, unknown>> } | Record<string, unknown>;
  try { payload = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const list = Array.isArray((payload as { messages?: unknown[] }).messages)
    ? ((payload as { messages: Array<Record<string, unknown>> }).messages)
    : [payload as Record<string, unknown>];

  const results: Array<{ id: string; channel: string; kind: string; leadId: string | null }> = [];

  for (const m of list.slice(0, 50)) {
    const from = String(m.from ?? '');
    const subject = String(m.subject ?? '').slice(0, 300);
    const body = String(m.body ?? m.snippet ?? '').slice(0, 4000);
    const externalId = m.messageId ? String(m.messageId).slice(0, 200) : null;
    if (!subject && !body) continue;

    // Skip anything already captured (the scanner may overlap windows).
    if (externalId) {
      const seen = await prisma.socialActivity.findFirst({ where: { url: `gmail:${externalId}` }, select: { id: true } });
      if (seen) continue;
    }

    const channel = channelFor(from, subject);
    const kind = kindFor(subject, body);
    const email = body.match(EMAIL_RE)?.[0]?.toLowerCase() ?? null;
    const phone = body.match(PHONE_RE)?.[0] ?? null;
    const name = m.name ? String(m.name).slice(0, 160) : subject.slice(0, 160);

    let leadId: string | null = null;
    if (['lead', 'dm', 'inquiry'].includes(kind) && (email || phone)) {
      const dupe = await findDuplicateLead(phone, email);
      if (dupe) leadId = dupe.id;
      else {
        const reference = await nextReference('LEAD');
        const lead = await prisma.lead.create({
          data: {
            reference, name: name || 'Social lead', email, phone,
            source: 'CAMPAIGN', requirement: body.slice(0, 500),
            consentAt: new Date(), consentSource: `${channel} notification email`,
            activities: { create: { type: 'NOTE', subject: `Captured from ${channel} email`, notes: subject } },
          },
        });
        leadId = lead.id;
      }
    }

    const activity = await prisma.socialActivity.create({
      data: { channel, kind, name, handle: from.slice(0, 120) || null, message: body.slice(0, 1000), url: externalId ? `gmail:${externalId}` : null, leadId },
    });
    await announceSocialActivity(activity.id);
    results.push({ id: activity.id, channel, kind, leadId });
  }

  return NextResponse.json({ ok: true, captured: results.length, results });
}

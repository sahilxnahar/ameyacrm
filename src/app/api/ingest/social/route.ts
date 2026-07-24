import { NextResponse, type NextRequest } from 'next/server';
import type { SocialChannel, LeadSource } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { nextReference } from '@/lib/utils/reference';
import { runAutomations } from '@/lib/automation/engine';
import { findDuplicateLead } from '@/lib/leads/dedup';
import { announceSocialActivity } from '@/lib/social/notify-social';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CH: Record<string, SocialChannel> = {
  whatsapp: 'WHATSAPP', linkedin: 'LINKEDIN', instagram: 'INSTAGRAM', insta: 'INSTAGRAM',
  facebook: 'FACEBOOK', fb: 'FACEBOOK', meta: 'FACEBOOK', twitter: 'TWITTER', x: 'TWITTER',
  youtube: 'YOUTUBE', yt: 'YOUTUBE', google: 'GOOGLE', website: 'WEBSITE',
};

/** Universal social/marketing capture. New lead / inquiry / subscriber / comment / DM / follower from any
 *  platform (pushed via Zapier/Make/IFTTT free tiers or native webhooks). Auth: INGEST_SECRET. */
export async function POST(req: NextRequest) {
  const secret = env.INGEST_SECRET;
  const key = req.headers.get('x-ingest-key') || req.nextUrl.searchParams.get('key');
  if (!secret || key !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const channel: SocialChannel = CH[String(b.channel ?? '').toLowerCase()] ?? 'OTHER';
  const kind = String(b.kind ?? b.type ?? 'activity').toLowerCase();
  const name = b.name ? String(b.name).slice(0, 160) : null;
  const handle = b.handle ? String(b.handle).slice(0, 120) : null;
  const message = b.message ? String(b.message).slice(0, 1000) : null;
  const url = b.url ? String(b.url).slice(0, 500) : null;
  const phone = b.phone ? String(b.phone).trim() : null;
  const email = b.email ? String(b.email).trim().toLowerCase() : null;

  // A lead/inquiry/DM with contact details also creates (or dedupes to) a CRM lead.
  let leadId: string | null = null;
  if (['lead', 'inquiry', 'dm', 'message'].includes(kind) && (phone || email)) {
    const dupe = await findDuplicateLead(phone, email);
    if (dupe) leadId = dupe.id;
    else {
      const reference = await nextReference('LEAD');
      const lead = await prisma.lead.create({
        data: { reference, name: name || handle || 'Social lead', phone, email, source: 'CAMPAIGN' as LeadSource, requirement: message || null,
          activities: { create: { type: 'NOTE', subject: `Captured from ${channel}`, notes: [handle, message].filter(Boolean).join(' · ') || null } } },
      });
      leadId = lead.id;
      try { await runAutomations('LEAD_CREATED', { entityType: 'Lead', entityId: lead.id, data: { name: lead.name, email, phone, source: 'CAMPAIGN', status: lead.status, score: lead.score } }); } catch { /* ignore */ }
    }
  }

  const activity = await prisma.socialActivity.create({ data: { channel, kind, name, handle, message, url, leadId } });
  await announceSocialActivity(activity.id);
  return NextResponse.json({ ok: true, activityId: activity.id, leadId });
}

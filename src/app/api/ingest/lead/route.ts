import { NextResponse, type NextRequest } from 'next/server';
import type { LeadSource } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { limitOr429, callerIp } from '@/lib/security/rate-limit';
import { nextReference } from '@/lib/utils/reference';
import { runAutomations } from '@/lib/automation/engine';
import { findDuplicateLead } from '@/lib/leads/dedup';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SOURCE_MAP: Record<string, LeadSource> = {
  website: 'WEBSITE', portal: 'PORTAL', '99acres': 'PORTAL', magicbricks: 'PORTAL', housing: 'PORTAL',
  meta: 'CAMPAIGN', facebook: 'CAMPAIGN', instagram: 'CAMPAIGN', google: 'CAMPAIGN', campaign: 'CAMPAIGN',
  referral: 'REFERRAL', broker: 'BROKER', walkin: 'WALK_IN',
};

/** Universal inbound lead capture. POST JSON from website forms, Zapier (Meta/Google Ads), or portal push.
 *  Auth: header `x-ingest-key: <INGEST_SECRET>` or `?key=<INGEST_SECRET>`. Dedupes on phone/email. */
export async function POST(req: NextRequest) {
  const over = await limitOr429(`ingest:lead:${await callerIp()}`, 120, 60);
  if (over) return over;

  const secret = env.INGEST_SECRET;
  const key = req.headers.get('x-ingest-key') || req.nextUrl.searchParams.get('key');
  if (!secret || key !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const name = String(body.name || body.full_name || '').trim();
  const phone = body.phone ? String(body.phone).trim() : null;
  const email = body.email ? String(body.email).trim().toLowerCase() : null;
  if (!name || (!phone && !email)) return NextResponse.json({ error: 'name and (phone or email) are required' }, { status: 400 });

  const srcRaw = String(body.source || 'portal').toLowerCase();
  const source: LeadSource = SOURCE_MAP[srcRaw] || 'PORTAL';
  const campaign = body.campaign ? String(body.campaign) : null;
  const note = [body.note ? String(body.note) : null, campaign ? `Campaign: ${campaign}` : null, `Captured via ${srcRaw}`].filter(Boolean).join(' · ');

  // Deduplication — attach a repeat-inquiry note to the ORIGINAL lead & keep its owner (no commission fight).
  const dupe = await findDuplicateLead(phone, email);
  if (dupe) {
    await prisma.leadActivity.create({ data: { leadId: dupe.id, userId: dupe.ownerId, type: 'NOTE', subject: 'Repeat inquiry (auto-captured)', notes: note } });
    return NextResponse.json({ ok: true, leadId: dupe.id, reference: dupe.reference, deduped: true, ownerId: dupe.ownerId });
  }

  let projectId: string | null = null;
  if (body.projectCode) {
    const pr = await prisma.project.findFirst({ where: { code: String(body.projectCode) }, select: { id: true } });
    projectId = pr?.id ?? null;
  }

  const reference = await nextReference('LEAD');
  const lead = await prisma.lead.create({
    data: {
      reference, name, phone, email, source,
      requirement: body.requirement ? String(body.requirement).slice(0, 300) : null,
      budgetMax: body.budget ? Number(body.budget) || null : null, projectId,
      activities: { create: { type: 'NOTE', subject: `Lead captured from ${srcRaw}`, notes: note } },
    },
  });
  try {
    await runAutomations('LEAD_CREATED', { entityType: 'Lead', entityId: lead.id, data: { name, email, phone, source, status: lead.status, score: lead.score } });
  } catch { /* ignore */ }
  return NextResponse.json({ ok: true, leadId: lead.id, reference, deduped: false });
}

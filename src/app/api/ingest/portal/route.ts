import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { nextReference } from '@/lib/utils/reference';
import { findDuplicateLead } from '@/lib/leads/dedup';
import { runAutomations } from '@/lib/automation/engine';
import { notifyMany } from '@/lib/notifications/notify';
import { parsePortalEmail, portalFor } from '@/lib/portals/parse';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Leads from 99acres, MagicBricks, Housing.com and the rest.
 *
 * Two ways in, both landing here:
 *   1. The Apps Script connector posts the portal's notification emails.
 *   2. A portal that supports webhooks posts JSON directly.
 *
 * Auth: INGEST_SECRET.
 */
export async function POST(req: NextRequest) {
  const secret = env.INGEST_SECRET;
  const key = req.headers.get('x-ingest-key') || req.nextUrl.searchParams.get('key');
  if (!secret || key !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let payload: Record<string, unknown>;
  try { payload = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const messages = Array.isArray(payload.messages) ? (payload.messages as Array<Record<string, unknown>>) : [payload];
  const created: Array<{ leadId: string; portal: string; name: string | null; action: string }> = [];

  for (const m of messages.slice(0, 50)) {
    // Either a raw email, or already-structured JSON from a webhook.
    const from = String(m.from ?? m.portal ?? '');
    const subject = String(m.subject ?? '');
    const body = String(m.body ?? m.snippet ?? '');
    const externalId = m.messageId ? String(m.messageId).slice(0, 200) : null;

    const parsed = body || subject
      ? parsePortalEmail(from, subject, body)
      : {
          portal: portalFor(from, ''),
          name: m.name ? String(m.name) : null,
          phone: m.phone ? String(m.phone) : null,
          email: m.email ? String(m.email).toLowerCase() : null,
          requirement: m.message ? String(m.message) : null,
          project: m.project ? String(m.project) : null,
          raw: JSON.stringify(m).slice(0, 2000),
        };

    if (!parsed.phone && !parsed.email) continue;   // nothing to contact them by

    if (externalId) {
      const seen = await prisma.socialActivity.findFirst({ where: { url: `portal:${externalId}` }, select: { id: true } });
      if (seen) continue;
    }

    const dupe = await findDuplicateLead(parsed.phone, parsed.email);
    let leadId: string;
    let action: string;

    if (dupe) {
      leadId = dupe.id;
      action = 'matched an existing lead';
      await prisma.leadActivity.create({
        data: {
          leadId, type: 'NOTE',
          subject: `New enquiry via ${parsed.portal}`,
          notes: [parsed.project, parsed.requirement].filter(Boolean).join(' · ').slice(0, 800) || null,
        },
      });
    } else {
      const project = parsed.project
        ? await prisma.project.findFirst({ where: { name: { contains: parsed.project.split(',')[0].trim(), mode: 'insensitive' } }, select: { id: true } })
        : null;
      const lead = await prisma.lead.create({
        data: {
          reference: await nextReference('LEAD'),
          name: parsed.name || parsed.phone || 'Portal enquiry',
          phone: parsed.phone, email: parsed.email,
          source: 'PORTAL',
          requirement: parsed.requirement,
          projectId: project?.id ?? null,
          consentAt: new Date(),
          consentSource: `${parsed.portal} enquiry`,
          activities: {
            create: { type: 'NOTE', subject: `Enquiry from ${parsed.portal}`, notes: parsed.raw.slice(0, 800) },
          },
        },
      });
      leadId = lead.id;
      action = 'created';
      try {
        await runAutomations('LEAD_CREATED', {
          entityType: 'Lead', entityId: lead.id,
          data: { name: lead.name, email: parsed.email, phone: parsed.phone, source: 'PORTAL', status: lead.status, score: lead.score },
        });
      } catch { /* automation failure must not lose the lead */ }
    }

    await prisma.socialActivity.create({
      data: {
        channel: 'OTHER', // SocialChannel has no portal member; the portal name is on 'handle'
        kind: 'lead',
        name: parsed.name,
        handle: parsed.portal,
        message: [parsed.project, parsed.requirement].filter(Boolean).join(' · ').slice(0, 1000) || null,
        url: externalId ? `portal:${externalId}` : null,
        summary: `${parsed.portal} enquiry from ${parsed.name ?? parsed.phone ?? 'someone'}${parsed.project ? ` about ${parsed.project}` : ''}`,
        notifiedAt: new Date(),
        leadId,
      },
    });

    const managers = await prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null, role: { in: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'MANAGER'] } },
      select: { id: true },
    });
    if (managers.length) {
      await notifyMany(managers.map((x) => x.id), {
        type: 'SYSTEM',
        title: `New ${parsed.portal} enquiry`,
        body: `${parsed.name ?? parsed.phone}${parsed.project ? ` — ${parsed.project}` : ''}`,
        link: `/sales?lead=${leadId}`,
      });
    }

    created.push({ leadId, portal: parsed.portal, name: parsed.name, action });
  }

  return NextResponse.json({ ok: true, captured: created.length, leads: created });
}

import { NextResponse, type NextRequest } from 'next/server';
import { requireHeaderSecret } from '@/lib/security/require-secret';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { limitOr429, callerIp } from '@/lib/security/rate-limit';
import { nextReference } from '@/lib/utils/reference';
import { findDuplicateLead, reopenStaleLead } from '@/lib/leads/dedup';
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
  const over = await limitOr429(`ingest:portal:${await callerIp()}`, 60, 60);
  if (over) return over;

  const denied = requireHeaderSecret(req, 'x-ingest-key', env.INGEST_SECRET);
  if (denied) return denied;

  let payload: Record<string, unknown>;
  try { payload = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const all = Array.isArray(payload.messages) ? (payload.messages as Array<Record<string, unknown>>) : [payload];
  const created: Array<{ leadId: string; portal: string; name: string | null; action: string }> = [];
  const unparsed: string[] = [];

  // Process a bounded batch, but NEVER silently discard the rest. The connector
  // used to advance its "last scanned" marker on any 200, so anything beyond
  // the cap was skipped and then never seen again — enquiries lost with no
  // error anywhere. `remaining` in the response tells the connector to hold its
  // marker and send the rest.
  const BATCH = 50;
  const messages = all.slice(0, BATCH);
  const remaining = Math.max(0, all.length - messages.length);

  for (const m of messages) {
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

    if (!parsed.phone && !parsed.email) {
      // No phone and no email — usually a portal changing its email template, or
      // a masked/IVR number. Skipping used to throw the enquiry away entirely.
      // Keep the raw message so a human can read it and chase it by hand.
      const rawKeep = (parsed.raw || `${subject}\n\n${body}`).slice(0, 2000);
      await prisma.socialActivity.create({
        data: {
          channel: 'OTHER', kind: 'unparsed', name: parsed.name, handle: parsed.portal,
          message: rawKeep,
          url: externalId ? `portal:${externalId}` : null,
          summary: `UNREAD ${parsed.portal} enquiry — no phone or email could be read from it. Open it and add the lead by hand.`,
          notifiedAt: new Date(),
        },
      }).catch(() => undefined);
      unparsed.push(subject || parsed.portal);
      continue;
    }

    if (externalId) {
      const seen = await prisma.socialActivity.findFirst({ where: { url: `portal:${externalId}` }, select: { id: true } });
      if (seen) continue;
    }

    const dupe = await findDuplicateLead(parsed.phone, parsed.email);
    let leadId: string;
    let action: string;

    if (dupe) {
      leadId = dupe.id;
      action = dupe.stale ? 'reopened a closed lead' : 'matched an existing lead';
      if (dupe.stale) await reopenStaleLead(dupe.id, `a new enquiry via ${parsed.portal}`);
      await prisma.leadActivity.create({
        data: {
          leadId, type: 'NOTE',
          subject: `New enquiry via ${parsed.portal}`,
          notes: [parsed.project, parsed.requirement].filter(Boolean).join(' · ').slice(0, 800) || null,
        },
      });
    } else {
      const project = parsed.project
        ? await prisma.project.findFirst({ where: { name: { contains: (parsed.project.split(',')[0] ?? '').trim(), mode: 'insensitive' } }, select: { id: true } })
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

  // `remaining` MUST be honoured by the connector: it may only advance its
  // "last scanned" marker when remaining === 0, otherwise the messages it did
  // not send this round are never looked at again.
  if (unparsed.length) {
    const managers = await prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null, role: { in: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'MANAGER'] } },
      select: { id: true }, take: 10,
    }).catch(() => []);
    await notifyMany(managers.map((x) => x.id), {
      type: 'SYSTEM',
      title: `${unparsed.length} portal enquir${unparsed.length === 1 ? 'y' : 'ies'} could not be read`,
      body: 'No phone or email could be read from them, so no lead was created. The original messages are saved — open them and add the leads by hand.',
      link: '/sales',
    }).catch(() => undefined);
  }

  return NextResponse.json({
    ok: true,
    captured: created.length,
    unparsed: unparsed.length,
    remaining,
    leads: created,
  });
}

import { NextResponse, type NextRequest } from 'next/server';
import type { LeadSource } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { limitOr429, callerIp } from '@/lib/security/rate-limit';
import { nextReference } from '@/lib/utils/reference';
import { runAutomations } from '@/lib/automation/engine';
import { findDuplicateLead } from '@/lib/leads/dedup';
import { normalizeLeadPayload, LEAD_CONNECTOR_SLUGS } from '@/lib/connectors/lead-normalize';
import { openConfig } from '@/server/services/connector-runtime';
import { safeEqual } from '@/lib/utils/crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Per-connector inbound lead endpoint: POST /api/connectors/leads/<slug>
 * Auth: the connector's own inbound secret via `?key=` or `x-connector-key`.
 * The portal's fields are normalised, deduped, and a lead is created — then the
 * usual lead-created automations, webhooks and connector announcements fire.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!LEAD_CONNECTOR_SLUGS.includes(slug)) return NextResponse.json({ error: 'unknown connector' }, { status: 404 });

  const over = await limitOr429(`connlead:${slug}:${await callerIp()}`, 120, 60);
  if (over) return over;

  const install = await prisma.connectorInstall.findUnique({ where: { slug } }).catch(() => null);
  if (!install || install.status !== 'INSTALLED') return NextResponse.json({ error: 'connector not installed' }, { status: 404 });

  const cfg = openConfig(install.config as Record<string, unknown> | null);
  const secret = String(cfg.inboundSecret ?? '');
  const provided = req.headers.get('x-connector-key') || req.nextUrl.searchParams.get('key') || '';
  if (!secret || !provided || !safeEqual(secret, provided)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const n = normalizeLeadPayload(body);
  if (!n.name || (!n.phone && !n.email)) return NextResponse.json({ error: 'name and (phone or email) are required' }, { status: 400 });

  const dupe = await findDuplicateLead(n.phone, n.email);
  if (dupe) {
    await prisma.leadActivity.create({ data: { leadId: dupe.id, userId: dupe.ownerId, type: 'NOTE', subject: `Repeat enquiry via ${slug}`, notes: n.requirement ?? '' } }).catch(() => undefined);
    return NextResponse.json({ ok: true, leadId: dupe.id, reference: dupe.reference, deduped: true });
  }

  let projectId: string | null = null;
  if (n.projectCode) {
    const pr = await prisma.project.findFirst({ where: { OR: [{ code: n.projectCode }, { name: { contains: n.projectCode, mode: 'insensitive' } }] }, select: { id: true } });
    projectId = pr?.id ?? null;
  }

  const reference = await nextReference('LEAD');
  const lead = await prisma.lead.create({
    data: {
      reference, name: n.name, phone: n.phone, email: n.email,
      source: 'PORTAL' as LeadSource,
      requirement: n.requirement ? n.requirement.slice(0, 300) : null,
      budgetMax: n.budget, projectId,
    },
  });

  try {
    await runAutomations('LEAD_CREATED', { entityType: 'Lead', entityId: lead.id, data: { name: lead.name, email: n.email, phone: n.phone, status: lead.status, source: slug, budgetMax: n.budget } });
  } catch { /* automations must not fail the capture */ }

  return NextResponse.json({ ok: true, leadId: lead.id, reference: lead.reference, created: true }, { status: 201 });
}

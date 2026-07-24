import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticateApiToken } from '@/lib/api/token-auth';
import { nextReference } from '@/lib/utils/reference';
import { findDuplicateLead } from '@/lib/leads/dedup';
import { runAutomations } from '@/lib/automation/engine';

export const dynamic = 'force-dynamic';

/** GET /api/v1/leads?limit=100&status=NEW — Bearer API token required. */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiToken(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const limit = Math.min(500, Number(req.nextUrl.searchParams.get('limit') || 100) || 100);
  const status = req.nextUrl.searchParams.get('status') || undefined;
  const leads = await prisma.lead.findMany({
    where: { deletedAt: null, ...(status ? { status: status as never } : {}) },
    orderBy: { updatedAt: 'desc' }, take: limit,
    select: { id: true, reference: true, name: true, email: true, phone: true, source: true, status: true, score: true, budgetMax: true, requirement: true, customFields: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ ok: true, count: leads.length, data: leads });
}

const WRITABLE = ['name', 'email', 'phone', 'status', 'source', 'requirement', 'locality', 'budgetMin', 'budgetMax', 'ownerId', 'projectId', 'temperature', 'nextFollowUp', 'customFields'] as const;

function pick(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const k of WRITABLE) {
    if (body[k] === undefined) continue;
    if (k === 'nextFollowUp') { const d = new Date(String(body[k])); if (!Number.isNaN(d.getTime())) data[k] = d; continue; }
    if (k === 'budgetMin' || k === 'budgetMax') { const n = Number(body[k]); if (!Number.isNaN(n)) data[k] = n; continue; }
    if (k === 'email') { data[k] = String(body[k]).toLowerCase().trim(); continue; }
    data[k] = body[k];
  }
  return data;
}

/**
 * POST /api/v1/leads — create a lead from another system.
 * Deduplicates on phone/email: an existing match is updated, not duplicated,
 * and the response says which happened.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateApiToken(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  if (!body.name && !body.phone && !body.email) return NextResponse.json({ error: 'name, phone or email is required' }, { status: 400 });

  const data = pick(body);
  const phone = data.phone ? String(data.phone) : null;
  const email = data.email ? String(data.email) : null;

  const dupe = await findDuplicateLead(phone, email);
  if (dupe) {
    const updated = await prisma.lead.update({ where: { id: dupe.id }, data });
    return NextResponse.json({ ok: true, action: 'updated', id: updated.id, reference: updated.reference });
  }

  const reference = await nextReference('LEAD');
  const lead = await prisma.lead.create({
    data: { reference, name: String(data.name ?? 'Unnamed lead'), ...data } as never,
  });
  try {
    await runAutomations('LEAD_CREATED', { entityType: 'Lead', entityId: lead.id, data: { name: lead.name, email, phone, status: lead.status, score: lead.score } });
  } catch { /* automation failure must not fail the write */ }

  return NextResponse.json({ ok: true, action: 'created', id: lead.id, reference: lead.reference }, { status: 201 });
}

/** PATCH /api/v1/leads — update by id, reference, phone or email. */
export async function PATCH(req: NextRequest) {
  const auth = await authenticateApiToken(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const where = body.id ? { id: String(body.id) }
    : body.reference ? { reference: String(body.reference) }
    : null;

  let id: string | null = where ? null : null;
  if (where) {
    const found = await prisma.lead.findUnique({ where: where as never, select: { id: true } });
    id = found?.id ?? null;
  } else {
    const dupe = await findDuplicateLead(body.phone ? String(body.phone) : null, body.email ? String(body.email).toLowerCase() : null);
    id = dupe?.id ?? null;
  }
  if (!id) return NextResponse.json({ error: 'lead not found' }, { status: 404 });

  const lead = await prisma.lead.update({ where: { id }, data: pick(body) });
  return NextResponse.json({ ok: true, action: 'updated', id: lead.id, reference: lead.reference });
}

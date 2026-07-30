import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { authenticateApiToken, hasScope } from '@/lib/api/token-auth';
import { WEBHOOK_EVENT_KEYS } from '@/lib/webhooks/events';

export const dynamic = 'force-dynamic';

/**
 * Programmatic webhook subscription — the REST-hook endpoint Zapier and Make use
 * to subscribe and unsubscribe automatically. Bearer API token required.
 *
 * POST   { url, events?: string[], source? }  → creates a subscription, returns id + secret
 * DELETE ?id=<id>  OR  { id }                  → removes a subscription
 * GET                                          → lists this workspace's webhooks
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiToken(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const hooks = await prisma.webhook.findMany({ orderBy: { createdAt: 'desc' }, take: 200, select: { id: true, url: true, events: true, isActive: true, source: true } });
  return NextResponse.json({ ok: true, data: hooks });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiToken(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasScope(auth, 'write')) return NextResponse.json({ error: 'this token is read-only (write scope required)' }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const url = String(body.url ?? '').trim();
  if (!/^https?:\/\/.+/i.test(url)) return NextResponse.json({ error: 'a valid https url is required' }, { status: 400 });

  const requested = Array.isArray(body.events) ? body.events.map(String) : [];
  const events = requested.filter((e) => WEBHOOK_EVENT_KEYS.includes(e));
  const finalEvents = events.length ? events : [...WEBHOOK_EVENT_KEYS];
  const source = ['zapier', 'make', 'api'].includes(String(body.source)) ? String(body.source) : 'api';

  const secret = `whsec_${randomBytes(24).toString('hex')}`;
  const w = await prisma.webhook.create({ data: { url, events: finalEvents, secret, source } });
  return NextResponse.json({ ok: true, id: w.id, secret, events: finalEvents }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateApiToken(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasScope(auth, 'write')) return NextResponse.json({ error: 'this token is read-only (write scope required)' }, { status: 403 });

  let id = req.nextUrl.searchParams.get('id') || '';
  if (!id) {
    try { const b = (await req.json()) as { id?: string }; id = String(b.id ?? ''); } catch { /* no body */ }
  }
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  await prisma.webhook.delete({ where: { id } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

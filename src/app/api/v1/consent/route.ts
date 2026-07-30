import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticateApiToken, hasScope } from '@/lib/api/token-auth';
import { CONSENT_PURPOSE_KEYS } from '@/lib/privacy/consent';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/consent — record a consent event from a web form or another
 * system. Bearer API token required.
 * Body: { email?, phone?, name?, purpose, status: "GIVEN"|"WITHDRAWN", source? }
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateApiToken(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasScope(auth, 'write')) return NextResponse.json({ error: 'this token is read-only (write scope required)' }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const email = body.email ? String(body.email).toLowerCase().trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;
  if (!email && !phone) return NextResponse.json({ error: 'email or phone is required' }, { status: 400 });

  const purpose = String(body.purpose ?? '');
  if (!CONSENT_PURPOSE_KEYS.includes(purpose)) return NextResponse.json({ error: `purpose must be one of ${CONSENT_PURPOSE_KEYS.join(', ')}` }, { status: 400 });
  const status = String(body.status ?? '').toUpperCase();
  if (status !== 'GIVEN' && status !== 'WITHDRAWN') return NextResponse.json({ error: 'status must be GIVEN or WITHDRAWN' }, { status: 400 });

  const rec = await prisma.consentRecord.create({
    data: {
      subjectEmail: email, subjectPhone: phone,
      subjectName: body.name ? String(body.name).slice(0, 120) : null,
      purpose, status, source: body.source ? String(body.source).slice(0, 40) : 'api',
    },
  });

  if (email && purpose === 'MARKETING') {
    await prisma.lead.updateMany({
      where: { email, deletedAt: null },
      data: status === 'GIVEN' ? { consentAt: new Date(), consentSource: 'api' } : { consentAt: null, consentSource: null },
    }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, id: rec.id }, { status: 201 });
}

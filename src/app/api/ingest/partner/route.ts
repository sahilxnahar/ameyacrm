import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { limitOr429, callerIp } from '@/lib/security/rate-limit';
import { notifyUsers } from '@/lib/notify/notify';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Inbound channel-partner registration. The website's "Become a channel partner"
 * form POSTs here and the broker lands straight in Channel Partners as PENDING,
 * ready for someone to approve — no more copying details out of an email.
 *
 * Auth: header `x-ingest-key: <INGEST_SECRET>` or `?key=<INGEST_SECRET>`.
 * Field names are forgiving: the form can send name/contactName, phone/number/
 * mobile, company/companyName/firmName, email — whatever it already sends.
 */
function pick(body: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = body[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

async function makeCode(): Promise<string> {
  const count = await prisma.channelPartner.count();
  return `CP-${1000 + count + 1}`;
}

export async function POST(req: NextRequest) {
  const over = await limitOr429(`ingest:partner:${await callerIp()}`, 60, 60);
  if (over) return over;

  const secret = env.INGEST_SECRET;
  const key = req.headers.get('x-ingest-key') || req.nextUrl.searchParams.get('key');
  if (!secret || key !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const contactName = pick(body, 'contactName', 'name', 'full_name', 'fullName', 'contact');
  const phone = pick(body, 'phone', 'number', 'mobile', 'contactNumber', 'phoneNumber');
  const email = pick(body, 'email', 'emailAddress').toLowerCase() || null;
  const firmName = pick(body, 'firmName', 'company', 'companyName', 'company_name', 'firm', 'organisation', 'organization') || contactName;
  const reraNumber = pick(body, 'reraNumber', 'rera') || null;
  const notes = pick(body, 'notes', 'message', 'note') || null;

  if (!contactName || !phone) {
    return NextResponse.json({ error: 'name and phone are required' }, { status: 400 });
  }

  // Don't create the same broker twice — if the phone (or email) already exists,
  // just note the repeat and point back at the original record.
  const existing = await prisma.channelPartner.findFirst({
    where: { OR: [{ phone }, ...(email ? [{ email }] : [])] },
    select: { id: true, code: true, firmName: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, id: existing.id, code: existing.code, deduped: true });
  }

  // Create the pending partner, retrying once if two registrations race for the
  // same generated code.
  let cp: { id: string; code: string } | null = null;
  for (let attempt = 0; attempt < 3 && !cp; attempt++) {
    const code = await makeCode();
    try {
      cp = await prisma.channelPartner.create({
        data: {
          code, firmName, contactName, phone, email,
          reraNumber,
          notes: [notes, 'Registered via website'].filter(Boolean).join(' · '),
          status: 'PENDING', kycStatus: 'PENDING',
        },
        select: { id: true, code: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue; // code clash — retry
      return NextResponse.json({ error: 'could not save' }, { status: 500 });
    }
  }
  if (!cp) return NextResponse.json({ error: 'could not save' }, { status: 500 });

  // Let the people who approve partners know one just came in.
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    await notifyUsers(admins.map((a) => a.id), {
      title: `New channel partner: ${firmName}`,
      body: `${contactName} · ${phone}${email ? ` · ${email}` : ''} — registered via the website. Review and approve in Channel Partners.`,
      link: '/partners',
    });
  } catch { /* notifying must never fail the capture */ }

  return NextResponse.json({ ok: true, id: cp.id, code: cp.code, deduped: false });
}

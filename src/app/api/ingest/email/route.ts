import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { limitOr429, callerIp } from '@/lib/security/rate-limit';
import { notifyMany } from '@/lib/notifications/notify';
import { threadKeyFor, extractAddress, matchParty, stripQuoted } from '@/lib/mail/thread';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Inbound and sent mail, posted by the Apps Script connector.
 *
 * Gmail is read with the account's own permission — no Cloud Console, no OAuth
 * app, no API project. Messages are threaded onto whichever lead or buyer owns
 * the address; anything from an unknown address is ignored rather than stored.
 *
 * Auth: INGEST_SECRET.
 */
export async function POST(req: NextRequest) {
  const over = await limitOr429(`ingest:email:${await callerIp()}`, 60, 60);
  if (over) return over;

  const secret = env.INGEST_SECRET;
  const key = req.headers.get('x-ingest-key') || req.nextUrl.searchParams.get('key');
  if (!secret || key !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let payload: { messages?: Array<Record<string, unknown>> };
  try { payload = (await req.json()) as { messages?: Array<Record<string, unknown>> }; }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const list = payload.messages ?? [];
  let stored = 0, skipped = 0, replies = 0, vendorMail = 0;

  for (const m of list.slice(0, 100)) {
    const externalId = String(m.messageId ?? '').slice(0, 200);
    if (!externalId) { skipped++; continue; }

    const already = await prisma.mailThreadMessage.findUnique({ where: { externalId }, select: { id: true } });
    if (already) { skipped++; continue; }

    const from = extractAddress(String(m.from ?? ''));
    const to = String(m.to ?? '').split(',').map((x) => extractAddress(x)).filter(Boolean);
    const outbound = Boolean(m.outbound);
    const counterparty = outbound ? (to[0] ?? '') : from;
    if (!counterparty) { skipped++; continue; }

    const party = await matchParty(counterparty);
    // Vendors count too. Previously anything that was not already a lead or a
    // buyer was thrown away, which meant every supplier quote and every
    // approval from an authority was silently discarded.
    if (!party.leadId && !party.customerId && !party.vendorId) { skipped++; continue; }

    const subject = m.subject ? String(m.subject).slice(0, 300) : null;
    const body = stripQuoted(String(m.body ?? '')).slice(0, 8000);

    await prisma.mailThreadMessage.create({
      data: {
        externalId,
        threadKey: threadKeyFor(subject, counterparty),
        direction: outbound ? 'OUTBOUND' : 'INBOUND',
        fromAddress: from,
        toAddresses: to,
        subject, bodyText: body, snippet: body.slice(0, 200),
        sentAt: m.date ? new Date(String(m.date)) : new Date(),
        leadId: party.leadId, customerId: party.customerId, vendorId: party.vendorId,
      },
    });
    stored++;

    if (!outbound && party.vendorId) {
      vendorMail++;
      const admins = await prisma.user.findMany({
        where: { status: 'ACTIVE', deletedAt: null, role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
        select: { id: true },
        take: 10,
      });
      await notifyMany(admins.map((a) => a.id), {
        type: 'SYSTEM',
        title: `${party.vendorName ?? 'A vendor'} emailed`,
        body: subject ?? 'New message',
        link: '/billing',
      });
    }

    if (!outbound && party.leadId) {
      replies++;

      // A reply is a signal: log it on the lead and stop any sequence chasing them.
      await prisma.leadActivity.create({
        data: { leadId: party.leadId, type: 'EMAIL', subject: subject ?? 'Reply received', notes: body.slice(0, 800) },
      });

      await prisma.sequenceEnrollment.updateMany({
        where: { leadId: party.leadId, status: 'RUNNING', sequence: { stopOnReply: true } },
        data: { status: 'REPLIED', endedAt: new Date(), endReason: 'They replied' },
      });

      const lead = await prisma.lead.findUnique({ where: { id: party.leadId }, select: { name: true, ownerId: true } });
      if (lead?.ownerId) {
        await notifyMany([lead.ownerId], {
          type: 'SYSTEM',
          title: `${lead.name} replied`,
          body: (subject ? `${subject} — ` : '') + body.slice(0, 120),
          link: `/sales?lead=${party.leadId}`,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, stored, replies, skipped, vendorMail });
}

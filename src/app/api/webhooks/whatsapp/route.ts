import { NextResponse, type NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { handleIncoming, type Incoming } from '@/server/services/whatsapp-inbox-service';
import { logError } from '@/lib/monitoring/log-error';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Where WhatsApp delivers messages sent to your business number.
 *
 * Set this URL in the Meta app under WhatsApp → Configuration → Webhook, with
 * the verify token below, and subscribe to the "messages" field.
 *
 *   https://crm.ameyaheights.com/api/webhooks/whatsapp
 */
export async function GET(req: NextRequest) {
  // Meta calls this once to prove you own the endpoint.
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && expected && token === expected) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }
  return NextResponse.json({ error: 'verification failed' }, { status: 403 });
}

/** Is this really from Meta? Signed with the app secret. */
function signatureValid(raw: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true;          // nothing to check against yet
  if (!header?.startsWith('sha256=')) return false;
  const mine = createHmac('sha256', secret).update(raw).digest('hex');
  const theirs = header.slice(7);
  if (mine.length !== theirs.length) return false;
  return timingSafeEqual(Buffer.from(mine), Buffer.from(theirs));
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (!signatureValid(raw, req.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  // Always answer 200 quickly. A non-200 makes Meta retry for hours and
  // eventually disable the webhook, which is worse than dropping one message.
  try {
    const body = JSON.parse(raw) as {
      entry?: Array<{ changes?: Array<{ value?: { messages?: Array<Record<string, unknown>> } }> }>;
    };

    const messages = body.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []) ?? [];

    for (const m of messages) {
      const type = String(m.type ?? '');
      const doc = m.document as { id?: string; filename?: string; mime_type?: string } | undefined;
      const img = m.image as { id?: string; mime_type?: string } | undefined;

      const incoming: Incoming = {
        externalId: String(m.id ?? ''),
        from: String(m.from ?? ''),
        kind: type === 'document' ? 'document' : type === 'image' ? 'image' : type === 'text' ? 'text' : 'other',
        text: (m.text as { body?: string } | undefined)?.body,
        mediaId: doc?.id ?? img?.id,
        filename: doc?.filename,
        mimeType: doc?.mime_type ?? img?.mime_type,
      };
      if (!incoming.externalId || !incoming.from) continue;

      // One bad message must not stop the rest of the batch.
      await handleIncoming(incoming).catch((e) => logError(e, { path: '/api/webhooks/whatsapp' }));
    }
  } catch (e) {
    await logError(e, { path: '/api/webhooks/whatsapp' });
  }

  return NextResponse.json({ ok: true });
}

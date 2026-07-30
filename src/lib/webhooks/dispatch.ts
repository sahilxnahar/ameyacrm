import 'server-only';
import { assertPublicUrl } from '@/lib/security/ssrf';
import { createHmac } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { fetchWithTimeout } from '@/lib/utils/fetch-timeout';
import type { WebhookEventKey } from '@/lib/webhooks/events';

/**
 * Fire an outbound webhook to every active subscriber of an event.
 *
 * Each delivery is a POST of a JSON body, signed with HMAC-SHA256 of the raw
 * body using the webhook's own secret, in the `x-ameya-signature` header
 * (`sha256=<hex>`), so the receiver can verify it really came from us. This is
 * how Zapier, Make and custom systems react to CRM activity.
 *
 * Fire-and-forget: never blocks or fails the action that triggered it. A webhook
 * that fails repeatedly is disabled automatically so a dead endpoint cannot slow
 * the CRM down forever.
 */
export async function dispatchWebhookEvent(event: WebhookEventKey, data: Record<string, unknown>): Promise<void> {
  let hooks;
  try {
    hooks = await prisma.webhook.findMany({ where: { isActive: true, events: { has: event } } });
  } catch {
    return; // table not migrated yet
  }
  if (!hooks.length) return;

  const body = JSON.stringify({ event, at: new Date().toISOString(), data });

  await Promise.all(hooks.map(async (h) => {
    const signature = createHmac('sha256', h.secret).update(body).digest('hex');
    try {
      // F-28: never let an admin-stored webhook URL point at an internal address.
      await assertPublicUrl(h.url);
      const res = await fetchWithTimeout(h.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ameya-event': event,
          'x-ameya-signature': `sha256=${signature}`,
          'user-agent': 'Ameya-CRM-Webhook/1',
        },
        body,
      }, 10000);
      const ok = res.status >= 200 && res.status < 300;
      await prisma.webhook.update({
        where: { id: h.id },
        data: {
          lastStatus: res.status,
          lastDeliveryAt: new Date(),
          lastError: ok ? null : `HTTP ${res.status}`,
          failureCount: ok ? 0 : { increment: 1 },
          // Give up on an endpoint after 15 straight failures.
          isActive: ok ? true : h.failureCount + 1 < 15,
        },
      }).catch(() => undefined);
    } catch (e) {
      await prisma.webhook.update({
        where: { id: h.id },
        data: {
          lastDeliveryAt: new Date(),
          lastError: (e instanceof Error ? e.message : 'delivery failed').slice(0, 300),
          failureCount: { increment: 1 },
          isActive: h.failureCount + 1 < 15,
        },
      }).catch(() => undefined);
    }
  }));
}

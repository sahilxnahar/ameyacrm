import 'server-only';
import { fetchWithTimeout } from '@/lib/utils/fetch-timeout';
import { assertPublicUrl } from '@/lib/security/ssrf';
import { formatConnectorMessage } from '@/lib/connectors/format';

export interface DriverResult { ok: boolean; message: string }

export interface ConnectorDriver {
  slug: string;
  /** Verify the credentials by doing something harmless (usually a test message). */
  test(config: Record<string, unknown>): Promise<DriverResult>;
  /** React to a CRM event by sending an outbound message. */
  send(event: string, data: Record<string, unknown>, config: Record<string, unknown>): Promise<DriverResult>;
}

/**
 * POST to a connector's webhook.
 *
 * ── AMH-020 ─────────────────────────────────────────────────────────────────
 *
 * The SSRF guard goes HERE, at the one place every driver funnels through,
 * rather than in each driver.
 *
 * The gap it closes was not "the URL is never validated" — `test()` does check
 * it, against a hostname pattern. It is that `send()` did not. So an admin
 * could paste a real `hooks.slack.com` URL, pass the test, then edit the stored
 * config to `http://169.254.169.254/latest/meta-data/` — and every subsequent
 * CRM event would fetch the cloud metadata endpoint and hand the response back
 * as a delivery result. Validate-on-write, trust-on-read is the shape of most
 * SSRF; the fix is to validate at the moment of the request.
 *
 * `assertPublicUrl` resolves the host and refuses private, loopback and
 * link-local addresses, so a public hostname pointing at 127.0.0.1 is caught
 * too.
 */
async function postJson(url: string, body: unknown): Promise<DriverResult> {
  try {
    await assertPublicUrl(url);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'That address is not reachable' };
  }
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, 10000);
    if (res.status >= 200 && res.status < 300) return { ok: true, message: 'Delivered' };
    return { ok: false, message: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'request failed' };
  }
}

const slack: ConnectorDriver = {
  slug: 'slack',
  async test(config) {
    const url = String(config.webhookUrl ?? '');
    if (!/^https:\/\/hooks\.slack\.com\//.test(url)) return { ok: false, message: 'Enter a valid Slack Incoming Webhook URL.' };
    return postJson(url, { text: '✅ Ameya CRM connected to Slack. You’ll see CRM activity here.' });
  },
  async send(event, data, config) {
    const url = String(config.webhookUrl ?? '');
    if (!url) return { ok: false, message: 'not configured' };
    return postJson(url, { text: formatConnectorMessage(event, data) });
  },
};

const discord: ConnectorDriver = {
  slug: 'discord',
  async test(config) {
    const url = String(config.webhookUrl ?? '');
    if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(url)) return { ok: false, message: 'Enter a valid Discord channel webhook URL.' };
    return postJson(url, { content: '✅ Ameya CRM connected to Discord.' });
  },
  async send(event, data, config) {
    const url = String(config.webhookUrl ?? '');
    if (!url) return { ok: false, message: 'not configured' };
    return postJson(url, { content: formatConnectorMessage(event, data) });
  },
};

const telegram: ConnectorDriver = {
  slug: 'telegram',
  async test(config) {
    const token = String(config.botToken ?? '');
    const chatId = String(config.chatId ?? '');
    if (!token || !chatId) return { ok: false, message: 'Enter both the bot token and the chat id.' };
    return postJson(`https://api.telegram.org/bot${token}/sendMessage`, { chat_id: chatId, text: '✅ Ameya CRM connected to Telegram.' });
  },
  async send(event, data, config) {
    const token = String(config.botToken ?? '');
    const chatId = String(config.chatId ?? '');
    if (!token || !chatId) return { ok: false, message: 'not configured' };
    return postJson(`https://api.telegram.org/bot${token}/sendMessage`, { chat_id: chatId, text: formatConnectorMessage(event, data) });
  },
};

const razorpay: ConnectorDriver = {
  slug: 'razorpay',
  async test(config) {
    const keyId = String(config.keyId ?? '');
    const keySecret = String(config.keySecret ?? '');
    if (!keyId || !keySecret) return { ok: false, message: 'Enter both the Key ID and Key Secret.' };
    try {
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const res = await fetchWithTimeout('https://api.razorpay.com/v1/payments?count=1', { headers: { Authorization: `Basic ${auth}` } }, 10000);
      if (res.status === 200) return { ok: true, message: 'Connected to Razorpay.' };
      if (res.status === 401) return { ok: false, message: 'Razorpay rejected these keys (401).' };
      return { ok: false, message: `Razorpay returned HTTP ${res.status}.` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'request failed' };
    }
  },
  async send() { return { ok: true, message: 'noop' }; }, // payments are inbound; nothing to send
};

const DRIVERS = new Map<string, ConnectorDriver>([
  ['slack', slack], ['discord', discord], ['telegram', telegram], ['razorpay', razorpay],
]);

export function driverFor(slug: string): ConnectorDriver | undefined { return DRIVERS.get(slug); }
export function hasDriver(slug: string): boolean { return DRIVERS.has(slug); }

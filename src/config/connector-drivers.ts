// Client-safe metadata for configurable connectors (v15.28).
// The server-side drivers (src/lib/connectors/registry.ts) implement the actual
// send/test using these same field + event definitions. Kept here (no server
// imports) so the App Exchange configure form can render without pulling server code.
import { OAUTH_PROVIDERS } from '@/config/oauth-providers';

export interface DriverField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  secret?: boolean;   // stored encrypted; never sent back to the browser in clear
  help?: string;
  placeholder?: string;
}

export interface DriverMeta {
  slug: string;         // matches a connector in the directory
  label: string;
  kind: 'messaging' | 'payments' | 'sheet' | 'leads' | 'oauth';
  fields: DriverField[];
  events: string[];     // CRM events it can react to (subset of webhook events)
  blurb: string;
}

// The CRM events a messaging connector can announce (mirror of webhook events).
const MSG_EVENTS = ['lead.created', 'lead.stage_changed', 'task.created', 'task.status_changed'];

export const DRIVER_META: DriverMeta[] = [
  {
    slug: 'slack', label: 'Slack', kind: 'messaging', events: MSG_EVENTS,
    blurb: 'Post CRM activity into a Slack channel via an Incoming Webhook.',
    fields: [
      { key: 'webhookUrl', label: 'Incoming Webhook URL', type: 'url', secret: true, placeholder: 'https://hooks.slack.com/services/…', help: 'Slack → Apps → Incoming Webhooks → Add. Paste the URL here.' },
    ],
  },
  {
    slug: 'discord', label: 'Discord', kind: 'messaging', events: MSG_EVENTS,
    blurb: 'Post CRM activity into a Discord channel via a channel webhook.',
    fields: [
      { key: 'webhookUrl', label: 'Channel Webhook URL', type: 'url', secret: true, placeholder: 'https://discord.com/api/webhooks/…', help: 'Discord → Channel settings → Integrations → Webhooks → New Webhook → Copy URL.' },
    ],
  },
  {
    slug: 'telegram', label: 'Telegram', kind: 'messaging', events: MSG_EVENTS,
    blurb: 'Send CRM activity to a Telegram chat or group via a bot.',
    fields: [
      { key: 'botToken', label: 'Bot token', type: 'password', secret: true, placeholder: '123456:ABC-DEF…', help: 'Create a bot with @BotFather and paste its token.' },
      { key: 'chatId', label: 'Chat ID', type: 'text', placeholder: '-1001234567890', help: 'The chat/group id to post into (add the bot to the group first).' },
    ],
  },
];

// ── Payments ─────────────────────────────────────────────────────────────────
DRIVER_META.push({
  slug: 'razorpay', label: 'Razorpay', kind: 'payments', events: [],
  blurb: 'Auto-reconcile payments. Add your keys to verify, then paste the webhook URL into Razorpay so captured payments land against the right booking.',
  fields: [
    { key: 'keyId', label: 'Key ID', type: 'text', placeholder: 'rzp_live_…', help: 'Razorpay Dashboard → Settings → API Keys.' },
    { key: 'keySecret', label: 'Key Secret', type: 'password', secret: true, help: 'Shown once when you generate the key.' },
    { key: 'webhookSecret', label: 'Webhook Secret', type: 'password', secret: true, help: 'Razorpay → Settings → Webhooks → the secret you set there.' },
  ],
});

// ── Inbound lead portals ─────────────────────────────────────────────────────
// These receive leads (portal → CRM). They're configured with a generated
// inbound URL + secret to paste into the portal, not with outbound credentials.
const LEAD_PORTALS: Array<[string, string]> = [
  ['99acres', '99acres'], ['magicbricks', 'MagicBricks'], ['housing-com', 'Housing.com'],
  ['nobroker', 'NoBroker'], ['square-yards', 'Square Yards'], ['sulekha', 'Sulekha'],
  ['commonfloor', 'CommonFloor'], ['proptiger', 'PropTiger'],
];
for (const [slug, label] of LEAD_PORTALS) {
  DRIVER_META.push({
    slug, label, kind: 'leads', events: [], fields: [],
    blurb: `Receive ${label} leads straight into the CRM. Paste the inbound URL and secret into your ${label} lead-push settings.`,
  });
}

// ── OAuth connectors ─────────────────────────────────────────────────────────
// Connected with the org's own OAuth app: paste a client id/secret, then Connect.
for (const p of OAUTH_PROVIDERS) {
  DRIVER_META.push({
    slug: p.slug, label: p.label, kind: 'oauth', events: [],
    blurb: `Connect ${p.label} with your own OAuth app: add the client id/secret, register the callback URL, then click Connect.`,
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', help: `From your ${p.label} app.` },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', secret: true },
    ],
  });
}

export const DRIVER_BY_SLUG = new Map(DRIVER_META.map((d) => [d.slug, d]));
export function driverMeta(slug: string): DriverMeta | undefined { return DRIVER_BY_SLUG.get(slug); }
export const CONFIGURABLE_SLUGS = new Set(DRIVER_META.map((d) => d.slug));
export function isConfigurable(slug: string): boolean { return CONFIGURABLE_SLUGS.has(slug); }

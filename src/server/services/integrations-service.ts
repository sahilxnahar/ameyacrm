import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';

export type Health = 'live' | 'configured' | 'off' | 'broken';

export interface Integration {
  key: string;
  name: string;
  category: 'AI' | 'Storage' | 'Communications' | 'Leads' | 'Payments' | 'Operations';
  what: string;           // what it does for you, in plain words
  health: Health;
  detail: string;         // why it is in that state
  needs: string;          // what it costs / what account it needs
  setupHref?: string;
  docs?: string;
}

/**
 * One honest view of every connector: whether it is switched on, and — where
 * we can tell cheaply — whether it is actually working rather than merely
 * configured. "Configured" and "working" are not the same thing, and pretending
 * otherwise is how integrations rot silently.
 */
export async function getIntegrations(): Promise<Integration[]> {
  const [socialCount, portalCount, chunkCount, errCount, subCount, sigCount, payCount] = await Promise.all([
    prisma.socialActivity.count({ where: { notifiedAt: { not: null } } }),
    prisma.socialActivity.count({ where: { kind: 'lead', handle: { not: null } } }),
    prisma.docChunk.count(),
    prisma.errorLog.count({ where: { resolvedAt: null } }),
    prisma.pushSubscription.count(),
    prisma.signatureRequest.count(),
    prisma.paymentRequest.count(),
  ]);

  const gas = Boolean(env.GAS_WEBAPP_URL && env.GAS_SECRET);
  const smtp = env.EMAIL_PROVIDER === 'smtp' || env.EMAIL_PROVIDER === 'ses';

  return [
    {
      key: 'gemini', name: 'Google Gemini', category: 'AI',
      what: 'Document summaries, bill extraction, lead scoring, call analysis, daily briefings, document Q&A.',
      health: env.GEMINI_API_KEY ? (chunkCount > 0 ? 'live' : 'configured') : 'off',
      detail: env.GEMINI_API_KEY ? (chunkCount > 0 ? `${chunkCount} passages indexed` : 'Key present — nothing indexed yet') : 'No API key set',
      needs: 'Free — AI Studio key, no Cloud Console',
      setupHref: '/ask',
    },
    {
      key: 'blob', name: 'Vercel Blob', category: 'Storage',
      what: 'Every uploaded document, floor plan, photo and signed PDF.',
      health: env.BLOB_READ_WRITE_TOKEN ? 'live' : 'broken',
      detail: env.BLOB_READ_WRITE_TOKEN ? 'Token present' : 'No token — uploads will fail',
      needs: 'Free tier on your Vercel account',
      setupHref: '/api/admin/storage-check',
    },
    {
      key: 'gas', name: 'Google Drive & Sheets', category: 'Storage',
      what: 'Copies documents to your own Drive and exports to Sheets. Also runs the hourly jobs Vercel’s free plan cannot.',
      health: gas ? 'live' : 'off',
      detail: gas ? 'Apps Script connector configured' : 'GAS_WEBAPP_URL and GAS_SECRET not set',
      needs: 'Free — your own Google account, no Cloud Console',
      setupHref: '/api/admin/drive-check',
    },
    {
      key: 'smtp', name: 'Email (SMTP)', category: 'Communications',
      what: 'Payment requests, overdue chasers, access approvals, signature requests.',
      health: smtp ? 'live' : 'off',
      detail: smtp ? `Sending as ${env.EMAIL_FROM}` : 'EMAIL_PROVIDER is "console" — mail is logged, not sent',
      needs: 'Free — Gmail app password or Brevo',
      setupHref: '/api/admin/email-check',
    },
    {
      key: 'push', name: 'Push notifications', category: 'Communications',
      what: 'Hourly reminders to phones when work goes past its date.',
      health: env.VAPID_PUBLIC_KEY ? (subCount > 0 ? 'live' : 'configured') : 'off',
      detail: env.VAPID_PUBLIC_KEY ? `${subCount} phone${subCount === 1 ? '' : 's'} registered` : 'VAPID keys not set',
      needs: 'Free — generated keys, no account',
      setupHref: '/admin/mobile-app',
    },
    {
      key: 'portals', name: 'Property portals', category: 'Leads',
      what: '99acres, MagicBricks, Housing.com — enquiries become leads automatically.',
      health: portalCount > 0 ? 'live' : gas ? 'configured' : 'off',
      detail: portalCount > 0 ? `${portalCount} portal enquiries captured` : gas ? 'Connector ready — add the scanPortalsOnce trigger' : 'Needs the Apps Script connector',
      needs: 'Free — reads the emails the portals already send',
      docs: 'Apps Script → scanPortalsOnce → every 15 minutes',
    },
    {
      key: 'social', name: 'Social channels', category: 'Leads',
      what: 'Instagram, LinkedIn, Facebook and X notifications become CRM alerts and leads.',
      health: socialCount > 0 ? 'live' : gas ? 'configured' : 'off',
      detail: socialCount > 0 ? `${socialCount} activities captured` : gas ? 'Connector ready — add the scanSocialOnce trigger' : 'Needs the Apps Script connector',
      needs: 'Free — no platform API required',
      setupHref: '/marketing',
    },
    {
      key: 'whatsapp', name: 'WhatsApp sending', category: 'Communications',
      what: 'Automatic WhatsApp reminders and broadcasts.',
      health: process.env.WHATSAPP_WEBHOOK_URL ? 'live' : 'off',
      detail: process.env.WHATSAPP_WEBHOOK_URL ? 'Gateway configured' : 'Manual only — one-tap links work today',
      needs: 'Paid — Meta Cloud API, AiSensy, WATI or Twilio',
      setupHref: '/admin/mobile-app',
    },
    {
      key: 'telephony', name: 'Telephony & call recording', category: 'Communications',
      what: 'Recordings transcribed by AI, with budget, BHK and timeline pulled out automatically.',
      health: env.TELEPHONY_SECRET ? 'configured' : 'off',
      detail: env.TELEPHONY_SECRET ? 'Webhook secret set — waiting for a provider' : 'The AI half is built and idle',
      needs: 'Paid per minute — Exotel or Knowlarity',
    },
    {
      key: 'esign', name: 'E-signature', category: 'Operations',
      what: 'Send a document, they draw a signature, it is stamped into the PDF with time and IP.',
      health: sigCount > 0 ? 'live' : 'configured',
      detail: sigCount > 0 ? `${sigCount} signature requests sent` : 'Built in — nothing sent yet',
      needs: 'Free — self-hosted, no DocuSign',
      setupHref: '/documents',
    },
    {
      key: 'payments', name: 'Payment requests', category: 'Payments',
      what: 'Ask anyone to pay by bank transfer, and confirm with a UTR.',
      health: payCount > 0 ? 'live' : 'configured',
      detail: payCount > 0 ? `${payCount} requests raised` : 'Built in — nothing raised yet',
      needs: 'Free — bank transfer, no gateway fee',
      setupHref: '/payment-requests',
    },
    {
      key: 'maps', name: 'Maps', category: 'Operations',
      what: 'Project pins and a lead heat-map by locality.',
      health: 'live',
      detail: 'OpenStreetMap — no key, no billing',
      needs: 'Free',
      setupHref: '/map',
    },
    {
      key: 'monitoring', name: 'Error monitoring', category: 'Operations',
      what: 'Every crash grouped and counted, with an email the first time each one appears.',
      health: errCount > 0 ? 'live' : 'configured',
      detail: errCount > 0 ? `${errCount} unresolved` : 'Nothing has gone wrong',
      needs: 'Free — built in, no Sentry account',
      setupHref: '/admin/errors',
    },
    {
      key: 'api', name: 'Public API', category: 'Operations',
      what: 'Read and write leads and units from another system — Tally, a website, anything.',
      health: 'live',
      detail: 'Token-authenticated at /api/v1',
      needs: 'Free',
      setupHref: '/admin/api-tokens',
    },
  ];
}

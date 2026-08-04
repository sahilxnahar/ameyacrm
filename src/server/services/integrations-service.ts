import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { storageIsPrivate } from '@/lib/storage/storage';

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
  /** The exact URL to paste into the provider to start it — the missing step
   *  that turns a "built but idle" channel into a working one. */
  webhookUrl?: string;
  webhookNote?: string;
  /** Numbered, plain-language "how to switch this on" steps. */
  steps?: string[];
}

/**
 * One honest view of every connector: whether it is switched on, and — where
 * we can tell cheaply — whether it is actually working rather than merely
 * configured. "Configured" and "working" are not the same thing, and pretending
 * otherwise is how integrations rot silently.
 */
export async function getIntegrations(): Promise<Integration[]> {
  const [socialCount, portalCount, chunkCount, errCount, subCount, sigCount, payCount, mailCount] = await Promise.all([
    prisma.socialActivity.count({ where: { notifiedAt: { not: null } } }),
    prisma.socialActivity.count({ where: { kind: 'lead', handle: { not: null } } }),
    prisma.docChunk.count(),
    prisma.errorLog.count({ where: { resolvedAt: null } }),
    prisma.pushSubscription.count(),
    prisma.signatureRequest.count(),
    prisma.paymentRequest.count(),
    prisma.mailThreadMessage.count(),
  ]);

  /*
   * Did last night's backup actually store anything? (AMH-034)
   *
   * The cron route used to swallow a storage failure, write an audit line
   * saying the backup had happened, and return HTTP 200. It has been failing
   * on bad S3 credentials and reporting success in all three places. The route
   * is fixed; this reads the audit trail so the answer is on a screen somebody
   * looks at, rather than in a cron log nobody does.
   */
  const lastBackup = await prisma.auditLog.findFirst({
    where: { entityType: 'Backup', action: 'EXPORT' },
    orderBy: { createdAt: 'desc' },
    select: { summary: true, createdAt: true },
  }).catch(() => null);
  const backupFailed = Boolean(lastBackup?.summary?.includes('FAILED'));
  const backupAgeH = lastBackup ? (Date.now() - lastBackup.createdAt.getTime()) / 3600e3 : null;
  // The job runs nightly, so anything past ~36 hours means it did not run at
  // all — a different failure from "it ran and could not store".
  const backupStale = backupAgeH != null && backupAgeH > 36;

  const gas = Boolean(env.GAS_WEBAPP_URL && env.GAS_SECRET);
  const smtp = env.EMAIL_PROVIDER === 'smtp' || env.EMAIL_PROVIDER === 'ses';
  const base = (env.APP_URL || 'https://crm.ameyaheights.com').replace(/\/$/, '');

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
      /*
       * 'warn', not 'live', when Blob is the provider and it is holding real
       * documents. Vercel Blob has no private mode: every object is readable by
       * anyone with the URL, permanently, and the folder-permission checks are
       * bypassed entirely by anyone who obtains one. That is a defensible
       * trade for a floor plan and an indefensible one for a title deed, and
       * the operator cannot make that call without being told.
       */
      health: !env.BLOB_READ_WRITE_TOKEN ? 'broken' : storageIsPrivate() ? 'live' : 'configured',
      detail: !env.BLOB_READ_WRITE_TOKEN
        ? 'No token — uploads will fail'
        : storageIsPrivate()
          ? 'Token present, files are private'
          : 'Token present — but files on Vercel Blob are readable by anyone with the link, forever. Use STORAGE_PROVIDER=s3 for title deeds, agreements and ID documents.',
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
      webhookUrl: `${base}/api/ingest/portal?key=YOUR_INGEST_SECRET`,
      webhookNote: 'The parser already understands 99acres, MagicBricks, Housing, CommonFloor and NoBroker enquiry emails.',
      steps: [
        'In your portal account, set enquiry notifications to arrive at your Ameya inbox (most already do).',
        'Open the Apps Script connector (Extensions → Apps Script on your linked Sheet) and enable the scanPortalsOnce trigger to run every 15 minutes.',
        'It forwards each new enquiry email to the URL above; matched enquiries appear as leads with the portal named as the source.',
      ],
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
      key: 'whatsapp', name: 'WhatsApp Business (two-way)', category: 'Communications',
      what: 'Send reminders and template broadcasts, and capture replies into a shared inbox.',
      health: (process.env.OPENWA_API_URL || process.env.WHATSAPP_WEBHOOK_URL || process.env.WHATSAPP_TOKEN) ? 'live' : 'off',
      detail: process.env.WHATSAPP_TOKEN
        ? 'Meta Cloud API connected — templates + two-way inbox'
        : process.env.OPENWA_API_URL
          ? 'OpenWA gateway connected — free-form messages, no Meta approval'
          : process.env.WHATSAPP_WEBHOOK_URL
            ? 'Gateway configured'
            : 'Manual only — one-tap links work today',
      needs: 'Self-hosted OpenWA (free), or Meta Cloud API / AiSensy / WATI / Twilio',
      setupHref: '/admin/integrations',
      webhookUrl: `${base}/api/webhooks/whatsapp`,
      webhookNote: 'For the Meta Cloud API: paste this as the Webhook Callback URL and use WHATSAPP_VERIFY_TOKEN as the Verify Token. Free Meta tier — not subject to your no-Google-billing rule.',
      steps: [
        'Create a Meta Business + WhatsApp app (free), and add WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_WABA_ID and WHATSAPP_VERIFY_TOKEN in Vercel → Environment Variables, then redeploy.',
        'In Meta → WhatsApp → Configuration, set the Callback URL above and the Verify Token, and subscribe to the "messages" field.',
        'Replies now land in the CRM against the matching lead/buyer; outbound reminders and template broadcasts send through the Cloud API automatically.',
      ],
    },
    {
      key: 'telephony', name: 'Telephony & call recording', category: 'Communications',
      what: 'Recordings transcribed by AI, with budget, BHK and timeline pulled out automatically.',
      health: env.TELEPHONY_SECRET ? 'configured' : 'off',
      detail: env.TELEPHONY_SECRET ? 'Webhook secret set — paste the URL below into your provider' : 'The AI half is built and idle — set TELEPHONY_SECRET to switch it on',
      needs: 'Paid per minute — Exotel or Knowlarity',
      webhookUrl: `${base}/api/telephony/webhook?key=YOUR_TELEPHONY_SECRET`,
      webhookNote: 'Provider-agnostic — works with Exotel, Knowlarity or Twilio. Accepts JSON or form-encoded call events.',
      steps: [
        'Set TELEPHONY_SECRET in Vercel → Environment Variables and redeploy.',
        'In Exotel/Knowlarity, add a call webhook (passthru/callback) pointing at the URL above, including the recording URL field.',
        'Each call is matched to a lead by phone number and logged; if a recording is attached, the AI transcribes it and extracts budget, typology, timeline and sentiment onto the lead.',
      ],
    },
    {
      key: 'email-inbound', name: 'Two-way email', category: 'Communications',
      what: 'Replies from leads, buyers and vendors thread onto their record — not just the mail you send out.',
      health: mailCount > 0 ? 'live' : gas ? 'configured' : 'off',
      detail: mailCount > 0 ? `${mailCount} messages threaded onto records` : gas ? 'Connector ready — enable the mail sync trigger' : 'Needs the Apps Script mail connector',
      needs: 'Free — reads your own Gmail with your permission, no Cloud Console',
      webhookUrl: `${base}/api/ingest/email?key=YOUR_INGEST_SECRET`,
      webhookNote: 'Inbound and sent mail are matched to a lead/buyer/vendor by address and threaded; unknown senders are ignored, quoted history is stripped.',
      steps: [
        'Open the Apps Script connector on your linked Google Sheet.',
        'Enable the mail-sync trigger (scan inbox + sent) to POST new messages to the URL above every few minutes.',
        'Conversations now appear on each lead/buyer/vendor record, both directions.',
      ],
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
      key: 'backup', name: 'Nightly backup', category: 'Operations',
      what: 'An encrypted snapshot of every record, written to object storage each night.',
      health: lastBackup == null ? 'off' : backupFailed || backupStale ? 'broken' : 'live',
      detail:
        lastBackup == null
          ? 'No backup has ever run. Nothing is being kept.'
          : backupFailed
            ? 'The last run built the snapshot and COULD NOT STORE IT. There is no usable backup — fix STORAGE_PROVIDER / the S3 credentials.'
            : backupStale
              ? `Last successful backup was ${Math.round(backupAgeH!)} hours ago. The job runs nightly, so it has not been running.`
              : `Last stored ${Math.round(backupAgeH ?? 0)}h ago`,
      needs: 'Needs S3-compatible object storage',
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

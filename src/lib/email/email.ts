import 'server-only';
import { fetchWithTimeout } from '@/lib/utils/fetch-timeout';
import nodemailer from 'nodemailer';
import { env } from '@/config/env';
import { resolveUserSmtp } from '@/server/services/user-smtp-service';

export interface EmailPayload { to: string[]; cc?: string[]; subject: string; text: string; html?: string }

/**
 * When `asUserId` is supplied, the mail is sent AS that user (their own address +
 * their stored app password over SMTP), instead of the shared org/no-reply sender.
 * User-composed mail (inbox replies, lead emails, Gmail compose) passes this;
 * system mail (password resets, digests, nudges) omits it and stays on the org
 * sender. Backwards compatible: existing `sendEmail(payload)` callers are untouched.
 */
export interface SendOptions { asUserId?: string }

/**
 * Pluggable email transport. Swap providers via EMAIL_PROVIDER without touching
 * callers. `console` just logs — perfect for local dev.
 */
export async function sendEmail(payload: EmailPayload, opts?: SendOptions): Promise<{ ok: boolean; error?: string }> {
  try {
    // Per-user outbound: send from the signed-in user's own mailbox when they've
    // connected one (and haven't opted out). Falls through to the provider switch
    // below only when no per-user mailbox resolves.
    if (opts?.asUserId) {
      const { config, source } = await resolveUserSmtp(opts.asUserId);
      if (config && source === 'user') {
        if (env.EMAIL_PROVIDER === 'console') {
          console.info('📧 [email:console:as-user]', { ...payload, from: config.from });
          return { ok: true };
        }
        const transport = nodemailer.createTransport({
          host: config.host, port: config.port, secure: config.secure,
          auth: { user: config.user, pass: config.pass },
        });
        await transport.sendMail({ from: config.from, to: payload.to, cc: payload.cc, subject: payload.subject, text: payload.text, html: payload.html });
        return { ok: true };
      }
      // No personal mailbox connected — fall back to the shared org sender below.
    }

    switch (env.EMAIL_PROVIDER) {
      case 'console':
        console.info('📧 [email:console]', { ...payload, from: env.EMAIL_FROM });
        return { ok: true };

      case 'resend': {
        if (!env.RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY missing' };
        const res = await fetchWithTimeout('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: env.EMAIL_FROM, to: payload.to, cc: payload.cc, subject: payload.subject, text: payload.text, html: payload.html }),
        });
        return res.ok ? { ok: true } : { ok: false, error: `Resend ${res.status}` };
      }

      case 'smtp':
      case 'ses': {
        // SES is reachable over SMTP; both share the nodemailer transport.
        const transport = nodemailer.createTransport({
          host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE,
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
        });
        await transport.sendMail({ from: env.EMAIL_FROM, to: payload.to, cc: payload.cc, subject: payload.subject, text: payload.text, html: payload.html });
        return { ok: true };
      }
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'send failed' };
  }
}

/** {{var}} substitution for stored EmailTemplate bodies. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

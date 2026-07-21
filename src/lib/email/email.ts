import 'server-only';
import { fetchWithTimeout } from '@/lib/utils/fetch-timeout';
import nodemailer from 'nodemailer';
import { env } from '@/config/env';

export interface EmailPayload { to: string[]; cc?: string[]; subject: string; text: string; html?: string }

/**
 * Pluggable email transport. Swap providers via EMAIL_PROVIDER without touching
 * callers. `console` just logs — perfect for local dev.
 */
export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; error?: string }> {
  try {
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

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requirePermission } from '@/lib/auth/current-user';
import { env } from '@/config/env';

export const dynamic = 'force-dynamic';

/** Show that a secret is present without ever leaking it. */
function mask(v?: string) {
  if (!v) return null;
  if (v.length <= 4) return '****';
  return `${v.slice(0, 2)}${'*'.repeat(Math.max(4, v.length - 4))}${v.slice(-2)}`;
}

/**
 * Admin self-test for outbound email.
 *   GET /api/admin/email-check            -> report config + verify the SMTP handshake
 *   GET /api/admin/email-check?to=a@b.com -> also send a real test message
 *
 * Returns the underlying transport error verbatim. Silent failure is the whole
 * problem with email; this endpoint exists to make it loud.
 */
export async function GET(req: Request) {
  await requirePermission('admin.setting.manage');
  const to = new URL(req.url).searchParams.get('to');
  const pass = env.SMTP_PASS ?? '';

  const config = {
    provider: env.EMAIL_PROVIDER,
    from: env.EMAIL_FROM,
    host: env.SMTP_HOST ?? null,
    port: env.SMTP_PORT ?? null,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER ?? null,
    passPresent: Boolean(pass),
    passMasked: mask(pass),
    passLength: pass.length,
    passHasSpaces: /\s/.test(pass),
  };

  const hints: string[] = [];
  if (env.EMAIL_PROVIDER === 'console') hints.push('EMAIL_PROVIDER is "console" - mail is only logged, never sent. Set it to "smtp".');
  if (config.passHasSpaces) hints.push('SMTP_PASS contains spaces. A Google App Password must be pasted as 16 unbroken characters.');
  if (pass && pass.replace(/\s/g, '').length !== 16 && (env.SMTP_HOST ?? '').includes('gmail')) hints.push(`SMTP_PASS is ${pass.replace(/\s/g, '').length} characters; a Google App Password is exactly 16.`);
  if (env.SMTP_PORT === 587 && env.SMTP_SECURE) hints.push('Port 587 needs SMTP_SECURE=false (it upgrades via STARTTLS). Only port 465 needs true.');
  if (env.SMTP_PORT === 465 && !env.SMTP_SECURE) hints.push('Port 465 needs SMTP_SECURE=true.');

  if (env.EMAIL_PROVIDER !== 'smtp' && env.EMAIL_PROVIDER !== 'ses') {
    return NextResponse.json({ ok: false, stage: 'config', config, hints }, { status: 400 });
  }
  if (!env.SMTP_HOST || !env.SMTP_PORT) {
    hints.push('SMTP_HOST and SMTP_PORT must both be set.');
    return NextResponse.json({ ok: false, stage: 'config', config, hints }, { status: 400 });
  }

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass } : undefined,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });

  // Stage 1 - can we connect and authenticate at all?
  try {
    await transport.verify();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/invalid login|username and password not accepted|535/i.test(msg)) hints.push('Authentication rejected. Either 2-Step Verification is off on this mailbox, the App Password is wrong, or SMTP_USER is not the mailbox that owns the App Password.');
    if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(msg)) hints.push('Could not reach the mail server. Check SMTP_HOST and SMTP_PORT.');
    return NextResponse.json({ ok: false, stage: 'connect', config, error: msg, hints }, { status: 500 });
  }

  if (!to) {
    return NextResponse.json({ ok: true, stage: 'connect', config, hints, message: 'SMTP connected and authenticated. Add ?to=you@example.com to send a real test message.' });
  }

  // Stage 2 - can we actually send, and does the From address survive?
  try {
    const info = await transport.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject: 'Ameya Heights CRM - email test',
      text: 'If you are reading this, outbound email from the CRM is working.',
    });
    return NextResponse.json({
      ok: true, stage: 'send', config, hints,
      accepted: info.accepted, rejected: info.rejected, response: info.response, messageId: info.messageId,
      message: `Accepted by the server for ${to}. If it does not arrive, check spam - it left the CRM successfully.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/from address|not allowed|553|555/i.test(msg)) hints.push('The server refused the From address. EMAIL_FROM must be the mailbox in SMTP_USER, or an alias verified under Gmail > Settings > Accounts > "Send mail as".');
    return NextResponse.json({ ok: false, stage: 'send', config, error: msg, hints }, { status: 500 });
  }
}

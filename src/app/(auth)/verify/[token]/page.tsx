import type { Metadata } from 'next';
import Link from 'next/link';
import { verifyEmailToken } from '@/server/actions/signup';

export const metadata: Metadata = { title: 'Confirm your email' };
export const dynamic = 'force-dynamic';

const COPY: Record<string, { title: string; body: string; cta: boolean }> = {
  invalid: { title: 'This link is not valid', body: 'It may already have been used. Try requesting access again, or ask an administrator to invite you.', cta: false },
  expired: { title: 'This link has expired', body: 'Verification links last 48 hours. Please request access again.', cta: false },
  already: { title: 'You are already confirmed', body: 'Your account is active — go ahead and sign in.', cta: true },
  active: { title: 'You are all set', body: 'Your email is confirmed and your account is active. Sign in with the email and password you just chose.', cta: true },
  pending_approval: { title: 'Email confirmed — one step to go', body: 'Because your address is outside the company domain, an administrator has been notified and will review your request. You will get an email as soon as it is approved.', cta: false },
};

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { outcome, name } = await verifyEmailToken(token);
  // An outcome the copy table does not know about should still say something
  // sensible rather than crash the page.
  const c = COPY[outcome] ?? COPY.invalid!;
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl font-semibold">{c.title}</h2>
      {name && <p className="text-sm font-medium">Hello {name},</p>}
      <p className="text-sm">{c.body}</p>
      {c.cta ? (
        <Link href="/login" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Go to sign in</Link>
      ) : (
        <Link href="/login" className="text-sm font-medium underline">Back to sign in</Link>
      )}
    </div>
  );
}

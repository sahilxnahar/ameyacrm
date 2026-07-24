import type { Metadata } from 'next';
import Link from 'next/link';
import { getSignupConfig } from '@/server/actions/signup';
import { SignupForm } from '@/components/auth/signup-form';

export const metadata: Metadata = { title: 'Request access' };
export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  const cfg = await getSignupConfig();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-semibold">Create your account</h2>
        <p className="mt-1 text-sm">
          {cfg.domains.length
            ? `Anyone with an @${cfg.domains[0]} address gets in straight away. Everyone else is reviewed by an administrator first.`
            : 'Every request is reviewed by an administrator.'}
        </p>
      </div>
      <SignupForm />
      <p className="text-sm">
        Already have an account? <Link href="/login" className="font-medium underline">Sign in</Link>
      </p>
    </div>
  );
}

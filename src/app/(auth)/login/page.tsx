import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';
import { getSignupConfig } from '@/server/actions/signup';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/dashboard');
  const { enabled } = await getSignupConfig();
  return (
    <div className="space-y-4">
      <LoginForm />
      {enabled && (
        <p className="text-sm">
          New here? <Link href="/signup" className="font-medium underline">Create an account</Link>
        </p>
      )}
    </div>
  );
}

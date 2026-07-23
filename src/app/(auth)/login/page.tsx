import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';
import { getSignupConfig } from '@/server/actions/signup';
import { getSamlConfig } from '@/lib/auth/saml';
import { prisma } from '@/lib/db/prisma';
import { InstallGuide } from '@/components/install/install-guide';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sso?: string }> }) {
  if (await getCurrentUser()) redirect('/home');
  const { enabled } = await getSignupConfig();
  const sso = await getSamlConfig();
  const { sso: ssoError } = await searchParams;
  const apkRow = await prisma.setting.findUnique({ where: { key: 'app.apkUrl' } }).catch(() => null);
  const apkUrl = (apkRow?.value as string) || null;
  return (
    <div className="space-y-4">
      {ssoError && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-sm">{ssoError}</p>}

      {sso.enabled && (
        <>
          <a href="/api/auth/saml/login"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[#D9D2C4] bg-white text-sm font-medium text-[#14120E]">
            Sign in with your work account
          </a>
          <p className="flex items-center gap-3 text-xs text-[#5E584C]">
            <span className="h-px flex-1 bg-[#D9D2C4]" /> or use a password <span className="h-px flex-1 bg-[#D9D2C4]" />
          </p>
        </>
      )}

      <LoginForm />
      {enabled && (
        <p className="text-sm">
          New here? <Link href="/signup" className="font-medium underline">Create an account</Link>
        </p>
      )}

      <details className="rounded-lg border border-[#D9D2C4] bg-white/70 p-3">
        <summary className="cursor-pointer text-sm font-medium text-[#14120E]">
          Use this on your phone — install the app
        </summary>
        <div className="mt-3">
          <InstallGuide apkUrl={apkUrl} compact />
        </div>
        <p className="mt-3 text-xs">
          <Link href="/install" className="font-medium text-[#8C6E2C] underline">Open the full instructions</Link>
        </p>
      </details>
    </div>
  );
}

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { brand } from '@/config/brand';
import { resolveSetupToken } from '@/server/services/onboarding-service';
import { SetPasswordForm } from '@/components/auth/set-password-form';

export const metadata: Metadata = { title: 'Set your password' };
export const dynamic = 'force-dynamic';

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const who = token ? await resolveSetupToken(token) : null;

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Image src={brand.assets.markGoldMetal} alt={brand.company.displayName} width={128} height={128} className="h-16 w-16" priority />
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#8C6E2C] dark:text-[#D9BE79]">{brand.company.displayName}</h1>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">CRM</p>
        </div>
      </div>

      {who ? (
        <div className="card-elevated p-6">
          <h2 className="font-display text-lg">Welcome, {who.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a password for <strong className="text-foreground">{who.username}</strong>. Nobody else will know it — not even an administrator.
          </p>
          <SetPasswordForm token={token!} />
        </div>
      ) : (
        <div className="card-elevated space-y-3 p-6 text-center">
          <h2 className="font-display text-lg">This link is no longer valid</h2>
          <p className="text-sm text-muted-foreground">
            Set-password links last seven days and work once. Ask an administrator to send you a new one from Admin → People.
          </p>
          <Link href="/login" className="focus-ring inline-block rounded-md border px-4 py-2 text-sm hover:bg-muted">Go to sign in</Link>
        </div>
      )}
    </div>
  );
}

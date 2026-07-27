import type { Metadata } from 'next';
import Image from 'next/image';
import { brand } from '@/config/brand';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = { title: 'Forgot password' };
export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-md space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Image src={brand.assets.markGoldMetal} alt={brand.company.displayName} width={128} height={128} className="h-16 w-16" priority />
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#8C6E2C] dark:text-[#D9BE79]">{brand.company.displayName}</h1>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">CRM</p>
        </div>
      </div>

      <div className="card-elevated p-6">
        <h2 className="font-display text-lg">Forgot your password?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your username or email and we&apos;ll send a one-time link to set a new one.
        </p>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}

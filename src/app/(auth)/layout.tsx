import Image from 'next/image';
import { brand } from '@/config/brand';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-charcoal lg:block">
        <div className="brass-gradient absolute inset-0 opacity-[0.08]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-sand">
          <Image src={brand.assets.markWhite} alt="" width={56} height={56} className="h-14 w-14 opacity-90" />
          <div className="max-w-md">
            <h1 className="font-display text-5xl font-semibold leading-tight text-white">
              {brand.company.displayName}
            </h1>
            <p className="mt-3 text-lg text-sand/80">{brand.company.tagline}</p>
            <p className="mt-8 text-sm text-sand/50">
              The operating system for {brand.company.legalName}. Every task owned. Every file
              searchable. Every action traceable.
            </p>
          </div>
          <p className="text-xs text-sand/40">{brand.company.website.replace('https://', '')}</p>
        </div>
      </div>
      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}

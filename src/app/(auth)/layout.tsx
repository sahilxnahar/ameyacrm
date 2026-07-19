import Image from 'next/image';
import { brand } from '@/config/brand';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-charcoal lg:block">
        <div className="brass-gradient absolute inset-0 opacity-[0.08]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-sand">
          <Image src={brand.assets.markWhite} alt="" width={112} height={112} className="h-24 w-24 opacity-95 sm:h-28 sm:w-28" />
          <div className="max-w-md">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-brass-light">CRM Platform</p>
            <h1 className="font-display text-6xl font-semibold leading-[1.03] text-white sm:text-7xl">
              {brand.company.displayName}
            </h1>
            <p className="mt-4 text-xl text-sand/80">{brand.company.tagline}</p>
            <p className="mt-8 text-sm text-sand/50">
              The CRM platform for {brand.company.legalName}. Every task owned. Every file
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

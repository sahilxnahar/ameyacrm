import Image from 'next/image';
import { brand } from '@/config/brand';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden lg:block" style={{ backgroundColor: '#0E1A36' }}>
        <div className="brass-gradient absolute inset-0 opacity-[0.06]" />
        <div className="relative flex h-full flex-col items-center justify-center px-12 text-center">
          <Image src={brand.assets.markGoldLight} alt="Ameya Heights" width={420} height={420} priority className="h-auto w-2/5 max-w-[380px]" />
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.32em] text-brass-light">CRM Platform</p>
          <h1 className="mt-3 font-display text-6xl font-semibold xl:text-7xl" style={{ color: '#C2A05B' }}>
            {brand.company.displayName}
          </h1>
          <p className="mt-4 text-xl text-sand/80">{brand.company.tagline}</p>
          <p className="mt-8 max-w-md text-sm text-sand/50">
            The CRM platform for {brand.company.legalName}. Every task owned. Every file
            searchable. Every action traceable.
          </p>
        </div>
        <p className="absolute inset-x-0 bottom-8 text-center text-xs text-sand/40">{brand.company.displayName}</p>
      </div>
      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}

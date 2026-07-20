import Image from 'next/image';
import { brand } from '@/config/brand';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden lg:block" style={{ background: 'linear-gradient(160deg, #0B2F73 0%, #0A2864 55%, #12439B 100%)' }}>
        <div className="brass-gradient absolute inset-0 opacity-[0.06]" />
        <div className="relative flex h-full flex-col items-center justify-center px-12 text-center">
          <Image src={brand.assets.markGoldLight} alt="Ameya Heights" width={560} height={560} priority className="h-auto w-3/5 max-w-[520px] drop-shadow-[0_6px_28px_rgba(0,0,0,0.35)]" />
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.32em] text-brass-light">CRM Platform</p>
          <h1 className="mt-4 whitespace-nowrap font-display font-semibold leading-none tracking-tight text-[clamp(2.75rem,5.2vw,5rem)]" style={{ color: '#E3C176' }}>
            {brand.company.displayName}
          </h1>
          <p className="mt-4 text-lg text-sand/75">{brand.company.tagline}</p>
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

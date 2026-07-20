import Image from 'next/image';
import { brand } from '@/config/brand';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden lg:block" style={{ background: 'linear-gradient(150deg, #0A2A6B 0%, #123F9E 48%, #1E5FD6 100%)' }}>
        <div className="brass-gradient absolute inset-0 opacity-[0.06]" />
        <div className="relative flex h-full flex-col items-center justify-center px-12 text-center">
          <Image src={brand.assets.markGoldMetal} alt="Ameya Heights" width={560} height={560} priority className="h-auto w-3/5 max-w-[520px] drop-shadow-[0_6px_28px_rgba(0,0,0,0.35)]" />
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
        <div className="absolute inset-x-0 bottom-7 text-center">
          <p className="text-sm font-medium text-sand/70">{brand.company.legalName}</p>
          <p className="mt-0.5 text-xs text-sand/40">{brand.company.website.replace('https://www.', '')}</p>
        </div>
      </div>
      {/* Form panel */}
      <div
        className="flex items-center justify-center p-6 sm:p-12"
        style={{
          backgroundColor: '#F8F5EE',
          '--background': '40 30% 98%',
          '--foreground': '40 12% 8%',
          '--card': '40 30% 99%',
          '--card-foreground': '40 12% 8%',
          '--muted': '37 22% 92%',
          '--muted-foreground': '40 8% 38%',
          '--border': '40 16% 80%',
          '--input': '40 16% 80%',
          '--secondary': '37 26% 90%',
          '--secondary-foreground': '40 12% 12%',
          '--primary': '40 51% 42%',
          '--primary-foreground': '40 30% 97%',
          '--ring': '40 51% 42%',
        } as React.CSSProperties}
      >
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}

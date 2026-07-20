import Image from 'next/image';
import { brand } from '@/config/brand';

/**
 * One continuous gradient across the whole page — deep navy → sapphire → sky → ivory.
 * The sign-in form sits in an elevated ivory card with explicitly dark text, so it
 * stays readable regardless of the visitor's light/dark system theme.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen w-full"
      style={{
        background:
          'linear-gradient(125deg, #04123A 0%, #0A2A6B 18%, #12409E 36%, #1E5FD6 52%, #6D9BEA 68%, #B9CFEF 82%, #F7F3EA 100%)',
      }}
    >
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-10 px-6 py-14 lg:flex-row lg:justify-between lg:gap-16 lg:px-10">
        {/* Brand */}
        <div className="flex w-full max-w-lg flex-col items-center text-center lg:items-start lg:text-left">
          <Image
            src={brand.assets.markGoldMetal}
            alt="Ameya Heights"
            width={560}
            height={560}
            priority
            className="h-auto w-48 drop-shadow-[0_8px_30px_rgba(0,0,0,0.35)] sm:w-56 lg:w-72"
          />
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.38em] text-[#E3C176]">Internal CRM Platform</p>
          <h1
            className="mt-3 whitespace-nowrap font-display font-bold leading-[0.95] tracking-tight text-[clamp(3.25rem,7vw,6rem)] drop-shadow-[0_4px_18px_rgba(0,0,0,0.35)]"
            style={{ color: '#F6E3AE' }}
          >
            {brand.company.displayName}
          </h1>
          <p className="mt-4 text-xl font-medium text-white/85 sm:text-2xl">{brand.company.tagline}</p>

          <p className="mt-7 max-w-md text-base leading-relaxed text-white/75">
            This is the private working system for {brand.company.legalName} — where every enquiry,
            booking, payment and site update is recorded.
          </p>
          <ul className="mt-5 max-w-md space-y-2 text-sm text-white/65">
            <li className="flex gap-2"><span aria-hidden className="text-[#E3C176]">•</span> Sales, inventory, collections and the buyer portal in one place</li>
            <li className="flex gap-2"><span aria-hidden className="text-[#E3C176]">•</span> Every action is logged against your name and visible to management</li>
            <li className="flex gap-2"><span aria-hidden className="text-[#E3C176]">•</span> Customer data here is confidential and covered by the DPDP Act</li>
          </ul>
          <p className="mt-6 max-w-md text-xs leading-relaxed text-white/50">
            Authorised staff and approved partners only. If you do not have an account,
            use &ldquo;Create an account&rdquo; — company email addresses are approved automatically,
            everyone else is reviewed by an administrator.
          </p>
        </div>

        {/* Sign-in card — forced dark text, independent of system theme */}
        <div className="w-full max-w-md">
          <div
            className="rounded-2xl border border-black/10 bg-[#FCFAF5]/95 p-7 shadow-[0_24px_70px_-20px_rgba(4,18,58,0.55)] backdrop-blur-sm sm:p-9
                       [&_a]:text-[#8C6E2C]
                       [&_h2]:text-[#14120E]
                       [&_input]:!bg-white [&_input]:!text-[#14120E] [&_input]:!border-[#D9D2C4] [&_input]:placeholder:!text-[#A8A093]
                       [&_label]:!text-[#2A261E]
                       [&_p:not([role=alert])]:!text-[#5E584C]"
            style={
              {
                color: '#14120E',
                '--background': '40 30% 98%',
                '--foreground': '40 12% 8%',
                '--card': '40 30% 99%',
                '--card-foreground': '40 12% 8%',
                '--muted': '37 22% 92%',
                '--muted-foreground': '40 8% 36%',
                '--border': '40 16% 80%',
                '--input': '40 16% 80%',
                '--secondary': '37 26% 90%',
                '--secondary-foreground': '40 12% 12%',
                '--primary': '40 51% 42%',
                '--primary-foreground': '40 30% 97%',
                '--ring': '40 51% 42%',
                '--destructive': '353 80% 34%',
                '--destructive-foreground': '40 30% 97%',
              } as React.CSSProperties
            }
          >
            {children}
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-5 text-center">
        <p className="text-xs font-medium text-[#1B2F55]/70">{brand.company.legalName}</p>
        <p className="text-[11px] text-[#1B2F55]/50">{brand.company.website.replace('https://www.', '')}</p>
      </div>
    </div>
  );
}

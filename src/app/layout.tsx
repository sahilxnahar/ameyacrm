import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter, Unbounded } from 'next/font/google';
import { brand } from '@/config/brand';
import { Providers } from '@/components/providers';
import { WebVitals } from '@/components/perf/web-vitals';
import './globals.css';

const display = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display' });
const body = Inter({ subsets: ['latin'], variable: '--font-body' });
const accent = Unbounded({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-accent' });

export const metadata: Metadata = {
  title: { default: `${brand.company.displayName} CRM`, template: `%s · ${brand.company.displayName} CRM` },
  description: `Internal CRM & ERP for ${brand.company.legalName}. ${brand.company.tagline}`,
  applicationName: `${brand.company.displayName} CRM`,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: `${brand.company.displayName} CRM` },
  icons: { icon: '/icons/icon.svg', apple: '/icons/icon-192.png' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ECE7DF' },
    { media: '(prefers-color-scheme: dark)', color: '#100F0D' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable} ${accent.variable}`}>
      <body className="font-sans">
        {/* Apply saved text size and density before first paint — no flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('amh:text-scale')||'m';var d=localStorage.getItem('amh:density')||'comfortable';var e=document.documentElement;e.setAttribute('data-text-scale',s);e.setAttribute('data-density',d);}catch(e){}})();`,
          }}
        />
        <WebVitals />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

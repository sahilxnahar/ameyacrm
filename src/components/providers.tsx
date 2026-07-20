'use client';
import * as React from 'react';
import { ThemeProvider as NextThemes } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { RegisterSW } from '@/components/pwa/register-sw';
import { NavProgress } from '@/components/feedback/nav-progress';
import { ConnectionBanner } from '@/components/feedback/connection-banner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <React.Suspense fallback={null}><NavProgress /></React.Suspense>
      {children}
      <ConnectionBanner />
      <Toaster />
      <RegisterSW />
    </NextThemes>
  );
}

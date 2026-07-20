'use client';
import * as React from 'react';
import { ThemeProvider as NextThemes } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { RegisterSW } from '@/components/pwa/register-sw';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
      <Toaster />
      <RegisterSW />
    </NextThemes>
  );
}

import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { SetupClient } from '@/components/setup/setup-client';

export const metadata: Metadata = { title: 'Setup' };
export const dynamic = 'force-dynamic';

export default function SetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <SetupClient appName={brand.company.displayName} />
    </div>
  );
}

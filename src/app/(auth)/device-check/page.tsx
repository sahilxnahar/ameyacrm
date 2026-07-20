import type { Metadata } from 'next';
import Link from 'next/link';
import { DeviceCheckForm } from '@/components/auth/device-check-form';

export const metadata: Metadata = { title: 'Confirm this device' };
export const dynamic = 'force-dynamic';

export default async function DeviceCheckPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-semibold">Confirm this device</h2>
        <p className="mt-1 text-sm">
          We have not seen this device before, so we have emailed a six-digit code to your work address.
          Enter it below to carry on.
        </p>
      </div>
      {t ? <DeviceCheckForm token={t} /> : <p role="alert" className="text-sm font-medium text-destructive">That link is not valid. Please sign in again.</p>}
      <p className="text-sm">
        Did not get it? Check spam, then <Link href="/login" className="font-medium underline">sign in again</Link> to send a fresh code.
      </p>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { DeviceCheckForm } from '@/components/auth/device-check-form';

export const metadata: Metadata = { title: 'Confirm this device' };
export const dynamic = 'force-dynamic';

export default async function DeviceCheckPage({ searchParams }: { searchParams: Promise<{ t?: string; sendfailed?: string }> }) {
  const { t, sendfailed } = await searchParams;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-semibold">Confirm this device</h2>
        <p className="mt-1 text-sm">
          We have not seen this device before. A six-digit code has been sent to your work email, and to your
          WhatsApp if your number is on file. Enter it below to carry on.
        </p>
      </div>
      {sendfailed === '1' && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <strong>The code could not be emailed.</strong> Nothing is wrong with your password — email sending is
          failing. An administrator should check Admin → Integrations. If nobody can sign in at all, device
          approval can be switched off in Admin → Security Policy from a device that is already trusted.
        </p>
      )}
      {t ? <DeviceCheckForm token={t} /> : <p role="alert" className="text-sm font-medium text-destructive">That link is not valid. Please sign in again.</p>}
      <p className="text-sm">
        Did not get it? Check spam, then <Link href="/login" className="font-medium underline">sign in again</Link> to send a fresh code.
      </p>
    </div>
  );
}

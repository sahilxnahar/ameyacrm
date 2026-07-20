import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { InstallGuide } from '@/components/install/install-guide';

export const metadata: Metadata = { title: 'Install the app' };
export const dynamic = 'force-dynamic';

/** Public — people need this before they can sign in on a phone. */
export default async function InstallPage() {
  const row = await prisma.setting.findUnique({ where: { key: 'app.apkUrl' } }).catch(() => null);
  const apkUrl = (row?.value as string) || null;

  return (
    <div className="min-h-screen w-full" style={{ background: 'linear-gradient(125deg, #04123A 0%, #0A2A6B 18%, #12409E 36%, #1E5FD6 52%, #6D9BEA 68%, #B9CFEF 82%, #F7F3EA 100%)' }}>
      <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center p-4">
        <div className="w-full rounded-2xl bg-[#FBF9F4] p-6 shadow-2xl sm:p-8">
          <h1 className="font-display text-2xl font-semibold text-[#14120E]">Put Ameya Heights CRM on your phone</h1>
          <p className="mt-1 text-sm text-[#5E584C]">
            It behaves like any other app — its own icon, works offline, and pushes reminders when something is overdue.
          </p>
          <div className="mt-5">
            <InstallGuide apkUrl={apkUrl} />
          </div>
          <p className="mt-6 text-sm">
            <Link href="/login" className="font-medium text-[#8C6E2C] underline">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

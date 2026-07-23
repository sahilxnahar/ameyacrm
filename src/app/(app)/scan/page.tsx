import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { ScanView } from '@/components/scan/scan-view';

export const metadata: Metadata = { title: 'Scan' };
export const dynamic = 'force-dynamic';

export default async function ScanPage() {
  await requirePermission('booking.view');
  return <ScanView />;
}

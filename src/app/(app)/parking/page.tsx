import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageLoadError } from '@/components/layout/page-load-error';
import { getParkingData } from '@/server/services/parking-service';
import { ParkingMatrix } from '@/components/parking/parking-matrix';

export const metadata: Metadata = { title: 'Parking Matrix' };
export const dynamic = 'force-dynamic';

export default async function ParkingPage() {
  await requirePermission('booking.view');
  try {
    const data = await getParkingData();
    return <ParkingMatrix data={data} />;
  } catch (e) {
    return <div className="space-y-4"><PageLoadError error={e} /></div>;
  }
}

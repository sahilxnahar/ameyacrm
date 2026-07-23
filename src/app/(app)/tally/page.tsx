import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageLoadError } from '@/components/layout/page-load-error';
import { getTallyData } from '@/server/services/tally-service';
import { TallyApp } from '@/components/tally/tally-app';

export const metadata: Metadata = { title: 'Ameya Tally' };
export const dynamic = 'force-dynamic';

export default async function TallyPage() {
  await requirePermission('finance.ledger.view');
  try {
    const data = await getTallyData();
    return <TallyApp data={data} />;
  } catch (e) {
    return <div className="space-y-4"><PageLoadError error={e} /></div>;
  }
}

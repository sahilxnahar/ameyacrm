import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageLoadError } from '@/components/layout/page-load-error';
import { getLitigationDocket, getDocRenewals } from '@/server/services/legal-service';
import { LegalDocket } from '@/components/legal/legal-docket';

export const metadata: Metadata = { title: 'Litigation & Renewals' };
export const dynamic = 'force-dynamic';

export default async function LitigationPage() {
  await requirePermission('land.view');
  try {
    const [docket, renewals] = await Promise.all([getLitigationDocket(), getDocRenewals(new Date())]);
    return <LegalDocket docket={docket} renewals={renewals} />;
  } catch (e) {
    return <div className="space-y-4"><PageLoadError error={e} /></div>;
  }
}

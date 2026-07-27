import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { getCertifierQueue } from '@/server/services/certifier-service';
import { CertifierPortalView } from '@/components/legal/certifier-portal-view';

export const metadata: Metadata = { title: 'Certifier Portal' };
export const dynamic = 'force-dynamic';

export default async function CertifierPortalPage() {
  await requirePermission('procurement.view');
  const { items, pendingRaBills } = await getCertifierQueue();
  return (
    <div className="space-y-6">
      <PageHeader title="Independent Certifier Portal" description="Everything awaiting an independent structural engineer's sign-off, in one place. Clearing a month's certification here releases that contractor's RA-bill payment — the gate is enforced server-side, so a payment can never run ahead of certification." />
      <CertifierPortalView items={items} pendingRaBills={pendingRaBills} />
    </div>
  );
}

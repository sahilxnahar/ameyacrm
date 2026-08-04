import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { CapitalGainsView } from '@/components/finance/capital-gains-view';

export const metadata: Metadata = { title: 'Capital Gains Simulator' };
export const dynamic = 'force-dynamic';

export default async function CapitalGainsPage() {
  await requirePermission('lead.view');
  const recent = await prisma.capitalGainScenario.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }).catch(() => []);
  return (
    <div className="space-y-6">
      <PageHeader title="Capital gains exemption simulator" description="A front-office tool for prospective buyers — show the tax saved under Section 54 / 54F by reinvesting sale proceeds into an Ameya Heights home. Figures update live; save a scenario to share it." />
      <CapitalGainsView recent={recent.map((s) => ({ id: s.id, saleValue: Number(s.saleValue), section: s.section, exemptGain: Number(s.exemptGain), taxSaved: Number(s.taxSaved), createdAt: s.createdAt.toISOString() }))} />
    </div>
  );
}

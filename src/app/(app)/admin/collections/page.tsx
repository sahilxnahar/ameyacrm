import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { CollectionsSettingsView } from '@/components/admin/collections-settings-view';

export const metadata: Metadata = { title: 'Collections & Tax' };

export default async function CollectionsSettingsPage() {
  await requirePermission('admin.setting.manage');
  const rows = await prisma.setting.findMany({ where: { key: { in: ['collections.interestPct', 'billing.defaultGstPct'] } } });
  const map = new Map(rows.map((r) => [r.key, r.value as unknown]));
  const num = (v: unknown, d: number) => (v == null ? d : Number(v) || d);
  return (
    <div className="max-w-2xl">
      <PageHeader title="Collections & tax" description="Late-payment interest and default GST." />
      <CollectionsSettingsView interestPct={num(map.get('collections.interestPct'), 18)} defaultGstPct={num(map.get('billing.defaultGstPct'), 5)} />
    </div>
  );
}

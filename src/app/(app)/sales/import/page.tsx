import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { LeadImport } from '@/components/sales/lead-import';

export const metadata: Metadata = { title: 'Import Leads' };

export default async function ImportLeadsPage() {
  await requirePermission('lead.create');
  return (
    <div className="max-w-2xl">
      <PageHeader title="Import leads" description="Bring existing leads into the CRM from a spreadsheet." />
      <LeadImport />
    </div>
  );
}

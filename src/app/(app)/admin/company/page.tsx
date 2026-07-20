import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { getCompanyDetails } from '@/server/services/company-service';
import { CompanyDetailsForm } from '@/components/admin/company-details-form';

export const metadata: Metadata = { title: 'Company details' };
export const dynamic = 'force-dynamic';

export default async function CompanyPage() {
  await requirePermission('admin.setting.manage');
  const details = await getCompanyDetails();
  return (
    <div>
      <PageHeader
        title="Company details"
        description="GST, bank and address details. These appear on every invoice, payment request and signature request — change them here and they change everywhere."
      />
      <CompanyDetailsForm details={details} />
    </div>
  );
}

import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { getCompanyDetails } from '@/server/services/company-service';
import { companyWarnings } from '@/config/company';
import { CompanyDetailsForm } from '@/components/admin/company-details-form';

export const metadata: Metadata = { title: 'Company details' };
export const dynamic = 'force-dynamic';

export default async function CompanyPage() {
  await requirePermission('admin.setting.manage');
  const details = await getCompanyDetails();
  const warnings = companyWarnings(details);
  return (
    <div>
      <PageHeader
        title="Company details"
        description="GST, bank and address details. These appear on every invoice, payment request and signature request — change them here and they change everywhere."
      />
      {warnings.length > 0 && (
        <div className="mb-5 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">
            {warnings.length === 1 ? 'One detail is wrong' : `${warnings.length} details are wrong`} and {warnings.length === 1 ? 'it is' : 'they are'} printing on documents right now
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-destructive/90">
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}
      <CompanyDetailsForm details={details} />
    </div>
  );
}

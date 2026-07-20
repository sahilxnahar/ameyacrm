import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { getTerms, getStages } from '@/server/services/customisation-service';
import { CustomisationView } from '@/components/admin/customisation-view';

export const metadata: Metadata = { title: 'Words & stages' };
export const dynamic = 'force-dynamic';

export default async function CustomisationPage() {
  await requirePermission('admin.setting.manage');
  const [terms, stages] = await Promise.all([getTerms(), getStages()]);
  return (
    <div>
      <PageHeader
        title="Words & stages"
        description="Rename what the CRM calls things, and set the stages a lead moves through with the odds of each closing."
      />
      <CustomisationView terms={terms} stages={stages} />
    </div>
  );
}

import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { dataQualityOverview } from '@/server/services/data-quality-service';
import { DATA_DICTIONARY } from '@/config/data-dictionary';
import { DataQualityView } from '@/components/data-quality/data-quality-view';

export const metadata: Metadata = { title: 'Data Quality' };
export const dynamic = 'force-dynamic';

export default async function DataQualityPage() {
  await requirePermission('data.view');
  try {
    const entities = await dataQualityOverview();
    return (
      <div className="space-y-6">
        <PageHeader
          title="Data Quality"
          description="How complete and consistent the core records are, the ones most likely to be duplicates, and what every field means. Nothing here changes your data — it produces a worklist, worst records first, so the twenty that matter get fixed."
        />
        <DataQualityView entities={entities} dictionary={DATA_DICTIONARY} />
      </div>
    );
  } catch (e) {
    return (
      <div className="space-y-6">
        <PageHeader title="Data Quality" description="Completeness, duplicates and the data dictionary." />
        <PageLoadError error={e} />
      </div>
    );
  }
}

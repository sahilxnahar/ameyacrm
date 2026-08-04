import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { getNavPrefsRow } from '@/server/services/nav-prefs-service';
import { readPrefs } from '@/lib/nav/prefs';
import { PageHeader } from '@/components/layout/page-header';
import { FeatureExplorer } from '@/components/features/feature-explorer';

export const metadata: Metadata = { title: 'Explore Features' };
export const dynamic = 'force-dynamic';

export default async function FeaturesPage() {
  const { user, permissions } = await requireAuth();
  // Personal colour and size choices. Read defensively — the launchpad must
  // still render if the preference column is unreadable.
  const prefs = readPrefs((await getNavPrefsRow(user.id).catch(() => null))?.navPrefs);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Explore features"
        description="Everything Ameya Heights CRM can do, in one place. Each area has its own colour, and the things you use daily are bigger — so you can aim rather than read. Press Customise to set your own."
      />
      <FeatureExplorer
        allowed={[...permissions.keys]}
        isSuperAdmin={permissions.isSuperAdmin}
        tones={prefs.tones}
        weights={prefs.weights}
      />
    </div>
  );
}

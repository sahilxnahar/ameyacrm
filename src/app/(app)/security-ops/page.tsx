import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { incidents } from '@/server/services/compliance-service';
import { SecopsRegister } from '@/components/compliance/secops-register';
export const metadata: Metadata = { title: 'Security Operations' };
export const dynamic = 'force-dynamic';
export default async function SecopsPage() {
  const ctx = await requirePermission('secops.view');
  const canManage = can(ctx.permissions, 'secops.manage');
  try {
    const rows = await incidents();
    return <div className="space-y-6"><PageHeader title="Security Operations" description="The incident register — anomalous access, exports, suspected breaches — tracked to resolution. Prevention is your locks; this is detection." /><SecopsRegister canManage={canManage} rows={rows} /></div>;
  } catch (e) { return <div className="space-y-6"><PageHeader title="Security Operations" description="Security incidents." /><PageLoadError error={e} /></div>; }
}

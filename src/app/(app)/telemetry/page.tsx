import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { getTelemetryOverview } from '@/server/services/telemetry-service';
import { TelemetryView } from '@/components/telemetry/telemetry-view';

export const metadata: Metadata = { title: 'Site Telemetry' };
export const dynamic = 'force-dynamic';

export default async function TelemetryPage() {
  const ctx = await requirePermission('telemetry.view');
  try {
    const [data, projects] = await Promise.all([
      getTelemetryOverview(),
      prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    return (
      <div className="space-y-6">
        <PageHeader title="Site Telemetry" description="Live readings from sensors, GPS trackers, fuel/power meters and drones on site. Devices POST their readings to a secure endpoint — this is the software side, ready for the hardware." />
        <TelemetryView data={data} projects={projects} canManage={can(ctx.permissions, 'telemetry.manage')} />
      </div>
    );
  } catch (e) {
    return <div className="space-y-6"><PageHeader title="Site Telemetry" description="Live site readings." /><PageLoadError error={e} /></div>;
  }
}

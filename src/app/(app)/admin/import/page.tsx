import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { ImportWizard } from '@/components/import/import-wizard';
import { IMPORT_KINDS } from '@/lib/import/schemas';

export const metadata: Metadata = { title: 'Import data' };
export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  await requirePermission('admin.setting.manage');
  const [projects, counts] = await Promise.all([
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    Promise.all([
      prisma.unit.count(),
      prisma.lead.count({ where: { deletedAt: null } }),
      prisma.booking.count(),
      prisma.paymentMilestone.count(),
      prisma.customer.count(),
    ]),
  ]);

  return (
    <div>
      <PageHeader
        title="Import data"
        description="Copy straight out of Excel and paste it in. Nothing is written until you have seen the preview."
      />
      <ImportWizard
        kinds={IMPORT_KINDS}
        projects={projects}
        counts={{ units: counts[0], leads: counts[1], bookings: counts[2], milestones: counts[3], customers: counts[4] }}
      />
    </div>
  );
}

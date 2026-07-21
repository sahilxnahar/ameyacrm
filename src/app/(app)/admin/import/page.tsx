import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { ImportWizard } from '@/components/import/import-wizard';
import { IMPORT_KINDS } from '@/lib/import/schemas';

export const metadata: Metadata = { title: 'Import data' };
export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const ctx = await requirePermission('admin.setting.manage');
  // Expenses are ledger data — an admin who has not been appointed to Finance
  // should not see the option, nor how many payments exist.
  const seesLedger = can(ctx.permissions, 'finance.ledger.view');
  const [projects, counts] = await Promise.all([
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    Promise.all([
      prisma.unit.count(),
      prisma.lead.count({ where: { deletedAt: null } }),
      prisma.booking.count(),
      prisma.paymentMilestone.count(),
      prisma.customer.count(),
      seesLedger ? prisma.voucher.count({ where: { kind: 'CASH_PAID' } }) : Promise.resolve(0),
    ]),
  ]);

  return (
    <div>
      <PageHeader
        title="Import data"
        description="Copy straight out of Excel and paste it in. Nothing is written until you have seen the preview."
      />
      <ImportWizard
        kinds={seesLedger ? IMPORT_KINDS : IMPORT_KINDS.filter((k) => k.key !== 'expenses')}
        projects={projects}
        counts={{ units: counts[0], leads: counts[1], bookings: counts[2], milestones: counts[3], customers: counts[4], expenses: counts[5] }}
      />
    </div>
  );
}

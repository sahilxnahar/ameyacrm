import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { CustomFieldsView } from '@/components/admin/custom-fields-view';

export const metadata: Metadata = { title: 'Custom Fields' };

export default async function CustomFieldsPage() {
  await requirePermission('admin.setting.manage');
  const fields = await prisma.customFieldDef.findMany({ orderBy: [{ entity: 'asc' }, { order: 'asc' }] });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Custom fields" description="Add your own fields to leads — no developer needed." />
      <CustomFieldsView fields={fields.map((f) => ({ id: f.id, entity: f.entity, key: f.key, label: f.label, type: f.type, options: f.options, required: f.required, order: f.order, isActive: f.isActive }))} />
    </div>
  );
}

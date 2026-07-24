import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { brand } from '@/config/brand';
import { PageHeader } from '@/components/layout/page-header';
import { BrandingForm } from '@/components/admin/branding-form';

export const metadata: Metadata = { title: 'Branding' };

export default async function BrandingPage() {
  await requirePermission('admin.setting.manage');
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: 'branding.' } } });
  const get = (k: string) => (rows.find((r) => r.key === k)?.value as string | undefined) ?? undefined;
  return (
    <div>
      <PageHeader title="Branding" description="Company name, tagline, and accent colour used across the app." />
      <BrandingForm
        initial={{
          displayName: get('branding.displayName') ?? brand.company.displayName,
          tagline: get('branding.tagline') ?? brand.company.tagline,
          primaryColor: get('branding.primaryColor') ?? brand.colors.brass,
          supportEmail: get('branding.supportEmail') ?? '',
        }}
      />
    </div>
  );
}

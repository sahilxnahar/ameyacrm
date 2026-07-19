import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { CheckInForm } from '@/components/inventory/check-in-form';

export const metadata: Metadata = { title: 'Site Visit Check-in' };

export default async function SiteVisitPage() {
  await requirePermission('lead.create');
  const projects = await prisma.project.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
  return (
    <div className="max-w-xl">
      <PageHeader title="Site visit check-in" description="Log a walk-in visitor — creates a lead and routes it instantly." />
      <CheckInForm projects={projects} />
    </div>
  );
}

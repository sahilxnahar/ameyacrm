import type { Metadata } from 'next';
import { Handshake, BadgeCheck, Clock, Wallet } from 'lucide-react';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
import { PartnersView } from '@/components/partners/partners-view';
import { formatCurrency } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Channel Partners' };

export default async function PartnersPage() {
  const ctx = await requirePermission('booking.view');
  const [partners, payouts, projects] = await Promise.all([
    prisma.channelPartner.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.brokeragePayout.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
  ]);
  const canManage = can(ctx.permissions, 'booking.manage');
  const due = payouts.filter((p) => p.status !== 'PAID').reduce((s, p) => s + Number(p.amount), 0);
  const approved = partners.filter((p) => p.status === 'APPROVED').length;
  const kycPending = partners.filter((p) => p.kycStatus === 'PENDING').length;
  return (
    <div>
      <PageHeader title="Channel Partners" description="Broker onboarding, RERA/KYC, lead protection and brokerage payouts." />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Partners" value={partners.length} icon={Handshake} />
        <StatCard label="Approved" value={approved} icon={BadgeCheck} tone="success" />
        <StatCard label="KYC pending" value={kycPending} icon={Clock} tone="warning" />
        <StatCard label="Brokerage due" value={formatCurrency(due)} icon={Wallet} />
      </div>
      <PartnersView
        canManage={canManage}
        projects={projects}
        partners={partners.map((p) => ({ id: p.id, code: p.code, firmName: p.firmName, contactName: p.contactName, phone: p.phone, email: p.email, reraNumber: p.reraNumber, panNumber: p.panNumber, gstin: p.gstin, commissionPct: Number(p.commissionPct), kycStatus: p.kycStatus, status: p.status }))}
        payouts={payouts.map((p) => ({ id: p.id, channelPartnerId: p.channelPartnerId, grossValue: Number(p.grossValue), ratePercent: Number(p.ratePercent), amount: Number(p.amount), stage: p.stage, status: p.status, dueDate: p.dueDate?.toISOString() ?? null }))}
      />
    </div>
  );
}

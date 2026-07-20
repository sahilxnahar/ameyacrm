import type { Metadata } from 'next';
import { IndianRupee, Clock, CheckCircle2, Send } from 'lucide-react';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
import { PaymentRequestsView } from '@/components/payments/payment-requests-view';
import { formatCurrency } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Payment requests' };

export default async function PaymentRequestsPage() {
  await requirePermission('billing.invoice.manage');
  const [rows, instructions, customers] = await Promise.all([
    prisma.paymentRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.setting.findUnique({ where: { key: 'payments.instructions' } }),
    prisma.customer.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 300 }),
  ]);
  const num = (v: unknown) => Number(v || 0);
  const outstanding = rows.filter((r) => !['PAID', 'CANCELLED'].includes(r.status)).reduce((s, r) => s + num(r.amount), 0);
  const collected = rows.filter((r) => r.status === 'PAID').reduce((s, r) => s + num(r.amount), 0);
  const awaiting = rows.filter((r) => r.status === 'CONFIRMED').length;

  return (
    <div>
      <PageHeader title="Payment requests" description="Ask anyone to pay — they get an email with a secure link." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} icon={Clock} tone="warning" />
        <StatCard label="Collected" value={formatCurrency(collected)} icon={CheckCircle2} tone="success" />
        <StatCard label="Awaiting verification" value={awaiting} icon={Send} tone={awaiting ? 'destructive' : 'default'} />
        <StatCard label="Total requests" value={rows.length} icon={IndianRupee} />
      </div>
      <PaymentRequestsView
        appUrl={(env.APP_URL || '').replace(/\/$/, '')}
        instructions={String(instructions?.value ?? '')}
        customers={customers}
        requests={rows.map((r) => ({
          id: r.id, reference: r.reference, token: r.token, payeeName: r.payeeName, payeeEmail: r.payeeEmail,
          payeePhone: r.payeePhone, amount: num(r.amount), description: r.description, status: r.status,
          dueDate: r.dueDate?.toISOString() ?? null, payerReference: r.payerReference,
          emailSentAt: r.emailSentAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}

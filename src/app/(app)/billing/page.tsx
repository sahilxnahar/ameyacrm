import type { Metadata } from 'next';
import { Receipt, FileClock, Wallet, AlertTriangle } from 'lucide-react';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
import { BillingView } from '@/components/billing/billing-view';
import { formatCurrency } from '@/lib/utils/format';
import { isGeminiEnabled } from '@/lib/ai/gemini';
import { VENDOR_CORE_SELECT } from '@/lib/db/vendor-select';

export const metadata: Metadata = { title: 'Billing' };

export default async function BillingPage() {
  const ctx = await requirePermission('billing.view');
  // Eight queries, and any one of them failing used to blank the whole screen —
  // including the "+ Bill" button, which is why "I cannot add a bill" and "the
  // page looks empty" were the same bug. Each falls back to empty instead.
  const [invoices, pos, bills, projects, vendors, approvers, agg, myPendingSteps] = await Promise.all([
    prisma.invoice.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { project: { select: { name: true } } } }).catch(() => []),
    prisma.purchaseOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { vendor: { select: { name: true } } } }).catch(() => []),
    prisma.vendorBill.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { vendor: { select: { name: true } } } }).catch(() => []),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true } }).catch(() => []),
    prisma.vendor.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: VENDOR_CORE_SELECT }).catch(() => []),
    prisma.user.findMany({ where: { status: 'ACTIVE', role: { in: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'] } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    prisma.invoice.aggregate({ _sum: { total: true, amountPaid: true } }).catch(() => ({ _sum: { total: null, amountPaid: null } })),
    prisma.approvalStep.findMany({ where: { approverId: ctx.user.id, status: 'PENDING', request: { entityType: 'PURCHASE_ORDER' } }, include: { request: { select: { entityId: true } } } }).catch(() => []),
  ]);

  const billed = Number(agg._sum.total ?? 0);
  const paid = Number(agg._sum.amountPaid ?? 0);
  const myPO = new Set(myPendingSteps.map((s) => s.request.entityId));

  return (
    <div>
      <PageHeader title="Billing" description="Invoices, purchase orders and vendor bills — GST-ready with approval flows." />
      <div className="mb-6 stat-grid">
        <StatCard label="Total billed" value={formatCurrency(billed)} icon={Receipt} />
        <StatCard label="Collected" value={formatCurrency(paid)} icon={Wallet} tone="success" />
        <StatCard label="Outstanding" value={formatCurrency(billed - paid)} icon={AlertTriangle} tone="warning" />
        <StatCard label="Open POs" value={pos.filter((p) => !['CLOSED', 'CANCELLED'].includes(p.status)).length} icon={FileClock} />
      </div>
      <BillingView
        projects={projects}
        vendors={vendors.map((v) => ({
          id: v.id, name: v.name, gstin: v.gstin, pan: v.pan, email: v.email, phone: v.phone, address: v.address,
          bankAccountName: v.bankAccountName, bankAccountNumber: v.bankAccountNumber, bankIfsc: v.bankIfsc,
          bankName: v.bankName, bankBranch: v.bankBranch, upiId: v.upiId, paymentNotes: v.paymentNotes,
        }))}
        approvers={approvers}
        canApprove={can(ctx.permissions, 'billing.approve')}
        canManage={can(ctx.permissions, 'billing.bill.manage') || can(ctx.permissions, 'billing.invoice.manage')}
        geminiEnabled={isGeminiEnabled()}
        invoices={invoices.map((i) => ({ id: i.id, number: i.number, client: i.clientName, status: i.status, total: Number(i.total), project: i.project?.name ?? null, dueDate: i.dueDate?.toISOString() ?? null }))}
        pos={pos.map((p) => ({ id: p.id, number: p.number, vendor: p.vendor?.name ?? '—', status: p.status, total: Number(p.total), needsMyApproval: myPO.has(p.id) }))}
        bills={bills.map((b) => ({
          id: b.id, number: b.number, vendor: b.vendor?.name ?? '—', status: b.status, amount: Number(b.amount),
          // Carried so a bill entered wrong can be corrected in place rather than
          // living in the books forever. Without these the edit dialog would open
          // blank and quietly wipe the GST and the dates on save.
          vendorId: b.vendorId ?? null,
          gstAmount: Number(b.gstAmount ?? 0),
          billDate: b.billDate ? b.billDate.toISOString().slice(0, 10) : null,
          dueDate: b.dueDate ? b.dueDate.toISOString().slice(0, 10) : null,
        }))}
      />
    </div>
  );
}

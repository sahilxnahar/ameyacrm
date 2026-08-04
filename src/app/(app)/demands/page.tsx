import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { DemandsView } from '@/components/finance/demands-view';

export const metadata: Metadata = { title: 'Payment Demands' };
export const dynamic = 'force-dynamic';

export default async function DemandsPage() {
  const ctx = await requirePermission('billing.view');
  const canManage = can(ctx.permissions, 'booking.manage');
  const [rows, pending, sent, paid, agg, bookings] = await Promise.all([
    prisma.demandNotice.findMany({
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }], take: 200,
      include: { booking: { select: { lead: { select: { id: true, name: true, preferredLang: true } }, unit: { select: { code: true } } } } },
    }).catch(() => []),
    prisma.demandNotice.count({ where: { status: 'PENDING' } }).catch(() => 0),
    prisma.demandNotice.count({ where: { status: 'SENT' } }).catch(() => 0),
    prisma.demandNotice.count({ where: { status: 'PAID' } }).catch(() => 0),
    prisma.demandNotice.aggregate({ where: { status: { in: ['PENDING', 'SENT'] } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: null } })),
    canManage
      ? prisma.booking.findMany({
          orderBy: { createdAt: 'desc' }, take: 300,
          select: { id: true, reference: true, lead: { select: { name: true } }, unit: { select: { code: true } } },
        }).catch(() => [])
      : Promise.resolve([]),
  ]);
  const outstanding = Number(agg._sum.amount ?? 0);
  return (
    <div className="space-y-6">
      <PageHeader title="Payment demands" description="Due and overdue buyer instalments, turned into WhatsApp + email reminders automatically. Demands generate and dispatch every day; collection converges back on the payment schedule and vouchers." />
      <DemandsView
        canManage={canManage}
        bookings={bookings.map((b) => ({
          id: b.id,
          label: `${b.lead?.name ?? b.reference}${b.unit?.code ? ` · ${b.unit.code}` : ''} · ${b.reference}`,
        }))}
        counts={{ pending, sent, paid, outstanding }}
        rows={rows.map((d) => ({
          id: d.id, number: d.number, label: d.label, kind: d.kind, status: d.status,
          amount: Number(d.amount), dueDate: d.dueDate ? d.dueDate.toISOString() : null,
          sentVia: d.sentVia, reminderCount: d.reminderCount, lastError: d.lastError,
          buyer: d.booking.lead?.name ?? '—', unit: d.booking.unit?.code ?? null,
          leadId: d.booking.lead?.id ?? null, lang: d.booking.lead?.preferredLang ?? 'en',
        }))}
      />
    </div>
  );
}

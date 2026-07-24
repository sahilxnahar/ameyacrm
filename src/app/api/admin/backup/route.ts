import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requirePermission } from '@/lib/auth/current-user';
import { writeAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Full data backup as JSON (sensitive auth secrets excluded). Admin only. */
export async function GET() {
  const ctx = await requirePermission('admin.user.manage');
  const [users, projects, units, leads, bookings, payments, customers, partners, brokerage, invoices] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, username: true, email: true, phone: true, role: true, status: true, departmentId: true, designation: true, createdAt: true } }),
    prisma.project.findMany(),
    prisma.unit.findMany(),
    prisma.lead.findMany({ where: { deletedAt: null } }),
    prisma.booking.findMany(),
    prisma.paymentMilestone.findMany(),
    prisma.customer.findMany({ select: { id: true, name: true, email: true, phone: true, bookingId: true, projectId: true, isActive: true, createdAt: true } }),
    prisma.channelPartner.findMany(),
    prisma.brokeragePayout.findMany(),
    prisma.invoice.findMany({ include: { items: true } }),
  ]);
  const bundle = { exportedAt: new Date().toISOString(), counts: { users: users.length, leads: leads.length, units: units.length, bookings: bookings.length, invoices: invoices.length }, users, projects, units, leads, bookings, payments, customers, partners, brokerage, invoices };
  await writeAudit({ actorId: ctx.user.id, action: 'EXPORT', entityType: 'Backup', summary: 'Downloaded full data backup' });
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(bundle, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="ameya-crm-backup-${date}.json"` } });
}

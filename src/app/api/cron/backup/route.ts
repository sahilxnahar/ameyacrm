import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { putObject } from '@/lib/storage/storage';
import { writeAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Nightly automated backup — writes a JSON snapshot to object storage. */
export async function GET(req: NextRequest) {
  const secret = env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  const key = req.nextUrl.searchParams.get('key');
  if (secret && auth !== `Bearer ${secret}` && key !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [users, projects, units, leads, bookings, payments, customers, partners, invoices] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, username: true, email: true, role: true, status: true, createdAt: true } }),
    prisma.project.findMany(), prisma.unit.findMany(), prisma.lead.findMany({ where: { deletedAt: null } }),
    prisma.booking.findMany(), prisma.paymentMilestone.findMany(),
    prisma.customer.findMany({ select: { id: true, name: true, email: true, phone: true, bookingId: true, isActive: true } }),
    prisma.channelPartner.findMany(), prisma.invoice.findMany({ include: { items: true } }),
  ]);
  const bundle = { exportedAt: new Date().toISOString(), users, projects, units, leads, bookings, payments, customers, partners, invoices };
  const body = Buffer.from(JSON.stringify(bundle), 'utf8');
  const stamp = new Date().toISOString().slice(0, 10);
  let stored: string | null = null;
  try {
    const res = await putObject(`backups/ameya-crm-backup-${stamp}.json`, body, 'application/json');
    stored = res.key;
  } catch { /* storage may be unconfigured */ }
  await writeAudit({ action: 'EXPORT', entityType: 'Backup', summary: `Automated backup ${stamp} (${(body.length / 1024).toFixed(0)} KB)` });
  return NextResponse.json({ ok: true, storedAs: stored, sizeKb: Math.round(body.length / 1024), counts: { leads: leads.length, units: units.length, bookings: bookings.length } });
}

import { NextResponse, type NextRequest } from 'next/server';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { writeAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** The month's cash book as a spreadsheet, for the accountant. */
export async function GET(req: NextRequest) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!can(ctx.permissions, 'finance.ledger.view')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const m = req.nextUrl.searchParams.get('m');
  const base = m ? new Date(`${m}-01T00:00:00`) : new Date();
  const from = startOfMonth(base);
  const to = endOfMonth(base);

  const rows = await prisma.voucher.findMany({
    where: { voucherDate: { gte: from, lte: to } },
    orderBy: [{ voucherDate: 'asc' }, { number: 'asc' }],
    take: 5000,
  });

  const IN = new Set(['CASH_RECEIVED', 'BANK_RECEIVED']);
  const OUT = new Set(['CASH_PAID', 'BANK_PAID']);
  let running = 0;

  const header = ['Date', 'Voucher', 'Type', 'Party', 'Material', 'Quantity', 'Unit', 'Mode', 'Reference', 'Narration', 'In', 'Out', 'Balance', 'Status'];
  const lines = [header.map(esc).join(',')];

  for (const v of rows) {
    const amt = Number(v.amount);
    const isIn = IN.has(v.kind) && v.status === 'POSTED';
    const isOut = OUT.has(v.kind) && v.status === 'POSTED';
    running += isIn ? amt : isOut ? -amt : 0;
    lines.push([
      format(v.voucherDate, 'dd/MM/yyyy'), v.number, v.kind.replace(/_/g, ' ').toLowerCase(),
      v.partyName, v.materialName ?? '', v.quantity ?? '', v.unit ?? '',
      v.mode.replace(/_/g, ' ').toLowerCase(), v.reference ?? '', v.narration ?? '',
      isIn ? amt : '', isOut ? amt : '', running, v.status.toLowerCase(),
    ].map(esc).join(','));
  }

  await writeAudit({ actorId: ctx.user.id, action: 'EXPORT', entityType: 'Invoice', summary: `Exported the cash book for ${format(base, 'MMMM yyyy')}` });

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cash-book-${format(base, 'yyyy-MM')}.csv"`,
    },
  });
}

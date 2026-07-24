import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { priceUnit, type PricingResult } from '@/lib/sales/pricing';
import { computeCommission } from '@/lib/sales/commission';
import { COMMISSION_SLABS, COMMISSION_TDS_PCT } from '@/config/sales';

const num = (d: unknown): number => (d == null ? 0 : Number(d));
const numN = (d: unknown): number | null => (d == null ? null : Number(d));

export interface UnitPricingRow {
  unitId: string;
  code: string;
  tower: string | null;
  floor: number | null;
  typology: string | null;
  areaSqft: number | null;
  facing: string | null;
  hasPricing: boolean;
  baseRatePerSqft: number;
  floorRisePerSqft: number;
  baseFloor: number;
  plcPerSqft: number;
  viewPremiumPerSqft: number;
  lumpSum: number;
  discountAmount: number;
  price: PricingResult | null;
}

/** Units for a project with their pricing configuration and the computed price. */
export async function unitPricing(projectId: string | null): Promise<UnitPricingRow[]> {
  const units = await prisma.unit.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: [{ tower: 'asc' }, { floor: 'asc' }, { code: 'asc' }],
    select: { id: true, code: true, tower: true, floor: true, typology: true, carpetAreaSqft: true, facing: true },
    take: 2000,
  });
  const pricings = await prisma.unitPricing.findMany({ where: { unitId: { in: units.map((u) => u.id) } } });
  const byUnit = new Map(pricings.map((p) => [p.unitId, p]));

  return units.map((u) => {
    const p = byUnit.get(u.id);
    const area = numN(u.carpetAreaSqft);
    const baseRate = num(p?.baseRatePerSqft);
    const price =
      p && area != null && baseRate > 0
        ? priceUnit({
            areaSqft: area,
            baseRatePerSqft: baseRate,
            floor: u.floor ?? 0,
            baseFloor: p.baseFloor,
            floorRisePerSqft: num(p.floorRisePerSqft),
            plcPerSqft: num(p.plcPerSqft),
            viewPremiumPerSqft: num(p.viewPremiumPerSqft),
            lumpSums: [num(p.lumpSum)],
            discountAmount: num(p.discountAmount),
          })
        : null;

    return {
      unitId: u.id, code: u.code, tower: u.tower, floor: u.floor, typology: u.typology,
      areaSqft: area, facing: u.facing,
      hasPricing: !!p,
      baseRatePerSqft: baseRate,
      floorRisePerSqft: num(p?.floorRisePerSqft),
      baseFloor: p?.baseFloor ?? 0,
      plcPerSqft: num(p?.plcPerSqft),
      viewPremiumPerSqft: num(p?.viewPremiumPerSqft),
      lumpSum: num(p?.lumpSum),
      discountAmount: num(p?.discountAmount),
      price,
    };
  });
}

export interface CommissionRow {
  id: string;
  channelPartnerId: string;
  partnerName: string;
  bookingValue: number;
  ratePct: number;
  grossCommission: number;
  tdsAmount: number;
  netPayable: number;
  status: string;
  paidOn: Date | null;
  createdAt: Date;
}

export interface CommissionOverview {
  rows: CommissionRow[];
  totalGross: number;
  totalNet: number;
  pendingCount: number;
  partners: Array<{ id: string; name: string; commissionPct: number }>;
}

export async function commissionOverview(projectId: string | null): Promise<CommissionOverview> {
  const [payouts, partners] = await Promise.all([
    prisma.commissionPayout.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 1000,
    }),
    prisma.channelPartner.findMany({ select: { id: true, firmName: true, commissionPct: true }, orderBy: { firmName: 'asc' } }),
  ]);
  const partnerName = new Map(partners.map((p) => [p.id, p.firmName]));

  const rows: CommissionRow[] = payouts.map((c) => ({
    id: c.id, channelPartnerId: c.channelPartnerId, partnerName: partnerName.get(c.channelPartnerId) ?? 'Unknown partner',
    bookingValue: num(c.bookingValue), ratePct: num(c.ratePct), grossCommission: num(c.grossCommission),
    tdsAmount: num(c.tdsAmount), netPayable: num(c.netPayable), status: c.status, paidOn: c.paidOn, createdAt: c.createdAt,
  }));

  return {
    rows,
    totalGross: rows.reduce((s, r) => s + r.grossCommission, 0),
    totalNet: rows.filter((r) => r.status !== 'CANCELLED').reduce((s, r) => s + r.netPayable, 0),
    pendingCount: rows.filter((r) => r.status === 'PENDING').length,
    partners: partners.map((p) => ({ id: p.id, name: p.firmName, commissionPct: num(p.commissionPct) })),
  };
}

/** Preview a commission for a partner + booking value, using the partner's own
 *  rate if set, else the slab table. Used by the action and can be shown live. */
export function previewCommission(bookingValue: number, partnerPct: number | null) {
  const slabs = partnerPct && partnerPct > 0 ? [{ fromValue: 0, ratePct: partnerPct }] : COMMISSION_SLABS;
  return computeCommission({ bookingValue, slabs, tdsRatePct: COMMISSION_TDS_PCT });
}

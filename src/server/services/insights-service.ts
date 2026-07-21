import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { detectAnomalies, type Anomaly } from '@/lib/ai/anomaly';

const num = (d: unknown): number => (d == null ? 0 : Number(d));

export interface MaterialAnomaly extends Anomaly {
  material: string;
  number: string;
  voucherDate: Date;
}

export interface ScoreBand {
  band: string;
  count: number;
}

export interface InsightsResult {
  anomalies: MaterialAnomaly[];
  materialsChecked: number;
  scoreBands: ScoreBand[];
  leadsScored: number;
}

/**
 * Two low-cost, statistical "insights" that need no live model and so cannot
 * fail on a missing key:
 *   1. Cost anomalies — for each material, the rate paid across bills is a
 *      comparable set; a bill 40%+ above that material's running rate is flagged.
 *   2. Lead-score distribution — how the pipeline's scores are spread, so a
 *      collapse toward zero (or everything maxed) is visible at a glance.
 */
export async function getInsights(thresholdPct = 40): Promise<InsightsResult> {
  const vouchers = await prisma.voucher.findMany({
    where: { materialName: { not: null }, rate: { not: null }, cancelledAt: null },
    select: { id: true, number: true, materialName: true, rate: true, voucherDate: true },
    take: 20000,
  });

  // Group each material's rates into its own comparable set.
  const byMaterial = new Map<string, typeof vouchers>();
  for (const v of vouchers) {
    const key = (v.materialName ?? '').trim().toLowerCase();
    if (!key) continue;
    const list = byMaterial.get(key) ?? [];
    list.push(v);
    byMaterial.set(key, list);
  }

  const anomalies: MaterialAnomaly[] = [];
  let materialsChecked = 0;
  for (const list of byMaterial.values()) {
    if (list.length < 3) continue;
    materialsChecked += 1;
    const material = list[0]!.materialName ?? '';
    const result = detectAnomalies(list.map((v) => ({ id: v.id, label: v.number, value: num(v.rate) })), thresholdPct);
    for (const a of result.anomalies) {
      const src = list.find((v) => v.id === a.id)!;
      anomalies.push({ ...a, material, number: src.number, voucherDate: src.voucherDate });
    }
  }
  anomalies.sort((a, b) => b.deviationPct - a.deviationPct);

  // Lead-score distribution in fixed bands.
  const leads = await prisma.lead.findMany({ where: { deletedAt: null }, select: { score: true }, take: 50000 });
  const bands = [
    { band: '0–20', lo: 0, hi: 20 },
    { band: '21–40', lo: 21, hi: 40 },
    { band: '41–60', lo: 41, hi: 60 },
    { band: '61–80', lo: 61, hi: 80 },
    { band: '81–100', lo: 81, hi: 100 },
  ];
  const scoreBands: ScoreBand[] = bands.map((b) => ({
    band: b.band,
    count: leads.filter((l) => l.score >= b.lo && l.score <= b.hi).length,
  }));

  return { anomalies: anomalies.slice(0, 100), materialsChecked, scoreBands, leadsScored: leads.length };
}

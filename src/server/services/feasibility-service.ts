import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { appraise, residualLandValue, type AppraisalResult } from '@/lib/feasibility/appraisal';

const num = (d: unknown): number => (d == null ? 0 : Number(d));
const numN = (d: unknown): number | null => (d == null ? null : Number(d));

export interface FeasibilityRow {
  id: string; name: string; projectId: string | null;
  landCost: number; constructionCost: number; financeCost: number; otherCost: number;
  saleableAreaSqft: number; salePricePerSqft: number; targetReturnPct: number | null;
  salePriceDeltaPct: number; costDeltaPct: number; notes: string | null;
  result: AppraisalResult; residualLand: number | null;
}

export async function feasibilityModels(projectId: string | null): Promise<FeasibilityRow[]> {
  const rows = await prisma.feasibilityModel.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((m) => {
    const base = {
      landCost: num(m.landCost), constructionCost: num(m.constructionCost), financeCost: num(m.financeCost),
      otherCost: num(m.otherCost), saleableAreaSqft: num(m.saleableAreaSqft), salePricePerSqft: num(m.salePricePerSqft),
      salePriceDeltaPct: num(m.salePriceDeltaPct), costDeltaPct: num(m.costDeltaPct),
    };
    const targetReturnPct = numN(m.targetReturnPct);
    return {
      id: m.id, name: m.name, projectId: m.projectId, ...base, targetReturnPct, notes: m.notes,
      result: appraise(base),
      residualLand: targetReturnPct != null ? residualLandValue(base, targetReturnPct) : null,
    };
  });
}

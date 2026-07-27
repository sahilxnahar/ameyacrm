import 'server-only';
import { prisma } from '@/lib/db/prisma';

/**
 * BOCW welfare compliance (module #67). The BOCW Act & Karnataka rules require a
 * site to provide drinking water, first-aid/medical, creche and sanitation. This
 * computes, per active project, which required categories have NO log this month
 * — the audit gap. Non-stop safe: every read is caught, so an un-migrated table
 * yields zero gaps rather than throwing.
 */
export const REQUIRED_WELFARE = ['DRINKING_WATER', 'MEDICAL_CAMP', 'CRECHE', 'SANITATION'] as const;

function monthStart(now: Date): Date { return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); }

export interface WelfareGap { projectId: string; project: string; missing: string[] }

export async function getWelfareCompliance(now = new Date()): Promise<{ gaps: WelfareGap[]; gapCount: number }> {
  try {
    const since = monthStart(now);
    const projects = await prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true } });
    const logs = await prisma.welfareLog.findMany({ where: { loggedOn: { gte: since } }, select: { projectId: true, category: true } });
    const byProject = new Map<string, Set<string>>();
    for (const l of logs) {
      if (!byProject.has(l.projectId)) byProject.set(l.projectId, new Set());
      byProject.get(l.projectId)!.add(l.category);
    }
    const gaps: WelfareGap[] = [];
    for (const p of projects) {
      const have = byProject.get(p.id) ?? new Set<string>();
      const missing = REQUIRED_WELFARE.filter((c) => !have.has(c));
      if (missing.length) gaps.push({ projectId: p.id, project: p.name, missing });
    }
    return { gaps, gapCount: gaps.reduce((n, g) => n + g.missing.length, 0) };
  } catch {
    return { gaps: [], gapCount: 0 };
  }
}

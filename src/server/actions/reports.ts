'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';
import { sourceByKey } from '@/config/report-sources';
import { buildReport } from '@/server/services/report-service';
import type { Metric, AggResult } from '@/lib/reports/aggregate';

export type ReportResult = { ok: true; message: string; id?: string } | { error: string };

const opt = (s: string) => { const t = (s ?? '').trim(); return t === '' ? null : t; };

function validate(v: Record<string, string>): { source: string; groupBy: string; metric: Metric; valueKey?: string } | { error: string } {
  const source = (v.source ?? '').trim();
  const src = sourceByKey(source);
  if (!src) return { error: 'Choose a source.' };
  const groupBy = (v.groupBy ?? '').trim();
  if (!src.groupBy.some((f) => f.key === groupBy)) return { error: 'Choose something to group by.' };
  const metric = (['count', 'sum', 'avg'].includes(v.metric ?? '') ? v.metric : 'count') as Metric;
  const valueKey = opt(v.valueKey ?? '') ?? undefined;
  if ((metric === 'sum' || metric === 'avg') && (!valueKey || !src.values.some((f) => f.key === valueKey))) {
    return { error: 'Pick a numeric field to measure.' };
  }
  return { source, groupBy, metric, valueKey };
}

/** Run a report live (no save) — used by the builder preview. */
export async function runReport(v: Record<string, string>): Promise<{ ok: true; result: AggResult & { ok: boolean; reason?: string } } | { error: string }> {
  try {
    await ensure('report.view');
    const parsed = validate(v);
    if ('error' in parsed) return { error: parsed.error };
    const result = await buildReport(parsed);
    return { ok: true, result };
  } catch (e) { return toActionError(e); }
}

/** Save a report definition so it can be re-run later. */
export async function saveReport(v: Record<string, string>): Promise<ReportResult> {
  try {
    const ctx = await ensure('report.build');
    const name = z.string().trim().min(2, 'Name the report.').parse(v.name ?? '');
    const parsed = validate(v);
    if ('error' in parsed) return { error: parsed.error };
    const x = await prisma.savedReport.create({
      data: {
        name,
        source: parsed.source,
        groupBy: parsed.groupBy,
        metric: parsed.metric,
        valueKey: parsed.valueKey ?? null,
        shared: v.shared === 'on' || v.shared === 'true',
        ownerId: ctx.user.id,
        createdById: ctx.user.id,
      },
      select: { id: true },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'SavedReport', entityId: x.id, summary: `Report "${name}"` });
    revalidatePath('/report-builder');
    return { ok: true, message: 'Report saved.', id: x.id };
  } catch (e) { return toActionError(e); }
}

/** Delete a saved report — only the owner (or a super admin) may. */
export async function deleteReport(id: string): Promise<ReportResult> {
  try {
    const ctx = await ensure('report.build');
    const existing = await prisma.savedReport.findUnique({ where: { id }, select: { ownerId: true, name: true } });
    if (!existing) return { error: 'That report no longer exists.' };
    const isSuper = ctx.permissions.isSuperAdmin || ctx.permissions.keys.has('*');
    if (existing.ownerId !== ctx.user.id && !isSuper) return { error: 'Only the person who saved a report can delete it.' };
    await prisma.savedReport.delete({ where: { id } });
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'SavedReport', entityId: id, summary: `Removed report "${existing.name}"` });
    revalidatePath('/report-builder');
    return { ok: true, message: 'Report deleted.' };
  } catch (e) { return toActionError(e); }
}

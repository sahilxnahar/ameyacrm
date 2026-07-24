'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { ensure, toActionError } from './_helpers';
import { runExplorer, type ExplorerEntity } from '@/server/services/explorer-service';
import { writeSheet } from '@/lib/google/sheets';

export type ViewResult = { ok: true; id?: string } | { error: string };

const viewSchema = z.object({
  name: z.string().min(2).max(60),
  entity: z.enum(['leads', 'bookings', 'units', 'collections']),
  filters: z.record(z.string(), z.string()).default({}),
  isShared: z.coerce.boolean().default(false),
});

export async function saveView(input: unknown): Promise<ViewResult> {
  try {
    const ctx = await ensure('report.view');
    const d = viewSchema.parse(input);
    const v = await prisma.savedView.create({ data: { name: d.name, entity: d.entity, filters: d.filters, isShared: d.isShared, ownerId: ctx.user.id } });
    revalidatePath('/reports/explorer');
    return { ok: true, id: v.id };
  } catch (err) { return toActionError(err); }
}

export async function deleteView(id: string): Promise<ViewResult> {
  try {
    const ctx = await ensure('report.view');
    const v = await prisma.savedView.findUnique({ where: { id }, select: { ownerId: true } });
    if (!v) return { error: 'View not found.' };
    if (v.ownerId && v.ownerId !== ctx.user.id && !ctx.permissions.isSuperAdmin) return { error: 'You can only delete your own views.' };
    await prisma.savedView.delete({ where: { id } });
    revalidatePath('/reports/explorer');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Push the current Explorer result straight into the connected Google Sheet. */
export async function pushToSheet(entity: string, filters: Record<string, string>): Promise<{ ok: true; rows: number } | { error: string }> {
  try {
    await ensure('report.export');
    const e = (['leads', 'bookings', 'units', 'collections'].includes(entity) ? entity : 'leads') as ExplorerEntity;
    const res = await runExplorer(e, filters, 5000);
    const rows = res.rows.map((r) => res.columns.map((c) => (r[c] ?? '') as string | number));
    return await writeSheet(e, res.columns, rows);
  } catch (err) { return toActionError(err); }
}

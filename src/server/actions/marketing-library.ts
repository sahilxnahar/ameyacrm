'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { can } from '@/lib/rbac/can';
import { getActionContext, toActionError } from './_helpers';
import { MARKETING_CATEGORIES, heuristicCategory, kindFromType } from '@/lib/marketing/library';

export type LibResult = { ok: true; count?: number } | { error: string };

/** AI categorisation with a keyword/extension fallback so it always returns something. */
async function categorize(files: Array<{ name: string; type: string }>): Promise<string[]> {
  const fallback = files.map((f) => heuristicCategory(f.name, f.type));
  try {
    const { aiChat } = await import('@/lib/ai/provider');
    const list = files.map((f, i) => `${i + 1}. ${f.name}`).join('\n');
    const res = await aiChat({
      system: 'You sort real-estate marketing files into categories. Return ONLY a JSON array of strings.',
      prompt: `Categorise each file into exactly one of these categories: ${MARKETING_CATEGORIES.join(', ')}.\nReturn a JSON array of category names, one per file, in the same order.\n${list}`,
      json: true, maxTokens: 600,
    });
    if (!res.ok) return fallback;
    const t = res.text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const s = t.indexOf('['), e = t.lastIndexOf(']');
    const arr = JSON.parse(s >= 0 && e >= 0 ? t.slice(s, e + 1) : t);
    if (!Array.isArray(arr)) return fallback;
    return files.map((_, i) => ((MARKETING_CATEGORIES as readonly string[]).includes(arr[i]) ? String(arr[i]) : fallback[i]!));
  } catch { return fallback; }
}

const itemSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.string().url(),
  fileType: z.string().max(120).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  folderPath: z.string().max(300).optional(),
});
const addSchema = z.object({ items: z.array(itemSchema).min(1).max(200) });

/** Register files the browser just uploaded to Blob, AI-sorting them into categories. */
export async function addMarketingLibraryItems(input: unknown): Promise<LibResult> {
  try {
    const ctx = await getActionContext();
    if (!can(ctx.permissions, 'marketing.manage') && !can(ctx.permissions, 'document.create')) return { error: 'You do not have permission to add marketing files.' };
    const d = addSchema.parse(input);
    const cats = await categorize(d.items.map((i) => ({ name: i.folderPath ? `${i.folderPath}/${i.title}` : i.title, type: i.fileType ?? '' })));
    await prisma.marketingLibraryItem.createMany({
      data: d.items.map((i, idx) => ({
        title: i.title, url: i.url, category: cats[idx] ?? 'Other', kind: kindFromType(i.title, i.fileType ?? ''),
        source: 'UPLOAD', fileType: i.fileType ?? null, sizeBytes: i.sizeBytes ?? null, folderPath: i.folderPath ?? null, uploadedById: ctx.user.id,
      })),
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'MarketingLibraryItem', entityId: 'bulk', summary: `Added ${d.items.length} marketing file(s)` });
    revalidatePath('/marketing/library');
    return { ok: true, count: d.items.length };
  } catch (e) { return toActionError(e); }
}

const driveSchema = z.object({ title: z.string().min(1).max(200), url: z.string().url('Enter a valid link') });

/** Add a Google Drive (or any web) link to view a document in place. */
export async function addMarketingDriveLink(input: unknown): Promise<LibResult> {
  try {
    const ctx = await getActionContext();
    if (!can(ctx.permissions, 'marketing.manage') && !can(ctx.permissions, 'document.create')) return { error: 'You do not have permission to add marketing files.' };
    const d = driveSchema.parse(input);
    const [cat] = await categorize([{ name: d.title, type: 'link' }]);
    const item = await prisma.marketingLibraryItem.create({ data: { title: d.title, url: d.url, category: cat ?? 'Other', kind: 'link', source: 'DRIVE', uploadedById: ctx.user.id } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'MarketingLibraryItem', entityId: item.id, summary: `Linked marketing doc ${d.title}` });
    revalidatePath('/marketing/library');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

export async function deleteMarketingLibraryItem(id: string): Promise<LibResult> {
  try {
    const ctx = await getActionContext();
    if (!can(ctx.permissions, 'marketing.manage')) return { error: 'Only marketing managers can remove library items.' };
    const item = await prisma.marketingLibraryItem.findUnique({ where: { id }, select: { title: true } });
    if (!item) return { error: 'Item not found.' };
    await prisma.marketingLibraryItem.delete({ where: { id } });
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'MarketingLibraryItem', entityId: id, summary: `Removed marketing file ${item.title}` });
    revalidatePath('/marketing/library');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

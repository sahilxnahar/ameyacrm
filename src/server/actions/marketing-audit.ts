'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { runAudit, type AuditKind, type AuditResult } from '@/server/services/marketing-audit-service';

const schema = z.object({
  kind: z.enum(['LANDING', 'SEO', 'AEO', 'COMPETITORS', 'ADS']),
  url: z.string().min(4).max(500),
  compareTo: z.string().max(500).optional().or(z.literal('')),
});

export type AuditActionResult = { ok: true; result: AuditResult } | { error: string };

/** Run one audit. Reading a page and asking a model both take a moment. */
export async function runMarketingAudit(input: unknown): Promise<AuditActionResult> {
  try {
    const ctx = await ensure('marketing.view');
    const d = schema.parse(input);
    const result = await runAudit(d.kind as AuditKind, d.url, { compareTo: d.compareTo || undefined, userId: ctx.user.id });
    await writeAudit({
      actorId: ctx.user.id, action: 'CREATE', entityType: 'MarketingAudit', entityId: result.id,
      summary: `${d.kind} audit of ${d.url}${result.error ? ' — failed' : result.score != null ? ` — ${result.score}/100` : ''}`,
    });
    revalidatePath('/marketing/audit');
    return { ok: true, result };
  } catch (e) {
    return toActionError(e);
  }
}

export type SaveAdsResult = { ok: true; created: number; message: string } | { error: string };

/** Turn generated ad copy into real, editable templates. */
export async function saveGeneratedAds(auditId: string): Promise<SaveAdsResult> {
  try {
    const ctx = await ensure('email.template.manage');
    const row = await prisma.marketingAudit.findUnique({ where: { id: auditId }, select: { output: true, hostname: true } });
    if (!row?.output) return { error: 'There is no ad copy on that audit.' };

    const out = row.output as {
      google?: Array<{ headline?: string; description?: string }>;
      meta?: Array<{ headline?: string; body?: string }>;
    };
    const stamp = new Date().toISOString().slice(0, 10);
    let created = 0;

    for (const [i, ad] of (out.google ?? []).entries()) {
      if (!ad.headline || !ad.description) continue;
      const key = `ad_google_${row.hostname.replace(/\W+/g, '_')}_${stamp}_${i + 1}`.toLowerCase().slice(0, 120);
      if (await prisma.messageTemplate.findUnique({ where: { key }, select: { id: true } })) continue;
      await prisma.messageTemplate.create({
        data: {
          key, name: `Google — ${ad.headline}`.slice(0, 160), channel: 'AD', category: 'GOOGLE_SEARCH',
          header: ad.headline, body: ad.description, createdById: ctx.user.id,
          description: `Written from ${row.hostname} on ${stamp}`,
        },
      });
      created++;
    }
    for (const [i, ad] of (out.meta ?? []).entries()) {
      if (!ad.headline || !ad.body) continue;
      const key = `ad_meta_${row.hostname.replace(/\W+/g, '_')}_${stamp}_${i + 1}`.toLowerCase().slice(0, 120);
      if (await prisma.messageTemplate.findUnique({ where: { key }, select: { id: true } })) continue;
      await prisma.messageTemplate.create({
        data: {
          key, name: `Meta — ${ad.headline}`.slice(0, 160), channel: 'AD', category: 'META_FEED',
          header: ad.headline, body: ad.body, createdById: ctx.user.id,
          description: `Written from ${row.hostname} on ${stamp}`,
        },
      });
      created++;
    }

    revalidatePath('/admin/message-templates');
    return {
      ok: true, created,
      message: created
        ? `${created} ad${created === 1 ? '' : 's'} saved as templates. Admin → Templates to edit them — they are checked against Google and Meta's limits there.`
        : 'Those ads are already saved.',
    };
  } catch (e) {
    return toActionError(e);
  }
}

'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { EXTRAS } from '@/config/marketplace';
import type { AutomationTrigger } from '@prisma/client';

export type MktResult = { ok: true; message?: string } | { error: string };

/** Which extras are already in place. Checked against the real records, not a flag. */
export async function installedExtras(): Promise<string[]> {
  await ensure('admin.setting.manage');
  const [rules, templates, views, fields, slabs] = await Promise.all([
    prisma.automationRule.findMany({ select: { name: true } }),
    prisma.emailTemplate.findMany({ select: { key: true } }),
    prisma.savedView.findMany({ select: { name: true } }),
    prisma.customFieldDef.findMany({ select: { entity: true, key: true } }),
    prisma.incentiveSlab.findMany({ where: { isActive: true }, select: { name: true } }),
  ]);

  const ruleNames = new Set(rules.map((r) => r.name));
  const tplKeys = new Set(templates.map((t) => t.key));
  const viewNames = new Set(views.map((v) => v.name));
  const fieldKeys = new Set(fields.map((f) => `${f.entity}:${f.key}`));
  const slabNames = new Set(slabs.map((s) => s.name));

  return EXTRAS.filter((e) => {
    const p = e.payload as Record<string, unknown>;
    switch (e.kind) {
      case 'automation': return ruleNames.has(String(p.name));
      case 'template':   return tplKeys.has(String(p.key));
      case 'view':       return viewNames.has(String(p.name));
      case 'fields': {
        const list = (p.fields as Array<{ key: string }>) ?? [];
        return list.length > 0 && list.every((f) => fieldKeys.has(`${String(p.entity)}:${f.key}`));
      }
      case 'incentive': {
        const list = (p.slabs as Array<{ name: string }>) ?? [];
        return list.length > 0 && list.every((s) => slabNames.has(s.name));
      }
      default: return false;
    }
  }).map((e) => e.id);
}

export async function installExtra(id: string): Promise<MktResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const extra = EXTRAS.find((e) => e.id === id);
    if (!extra) return { error: 'That extra no longer exists.' };
    const p = extra.payload as Record<string, unknown>;

    switch (extra.kind) {
      case 'automation': {
        const exists = await prisma.automationRule.findFirst({ where: { name: String(p.name) }, select: { id: true } });
        if (exists) return { error: 'Already installed.' };
        await prisma.automationRule.create({
          data: {
            name: String(p.name),
            description: p.description ? String(p.description) : null,
            trigger: String(p.trigger) as AutomationTrigger,
            conditions: (p.conditions ?? []) as object,
            actions: (p.actions ?? []) as object,
            isActive: false,          // installed switched off — you check it, then turn it on
            createdById: ctx.user.id,
          },
        });
        break;
      }
      case 'template': {
        const exists = await prisma.emailTemplate.findUnique({ where: { key: String(p.key) }, select: { id: true } });
        if (exists) return { error: 'Already installed.' };
        await prisma.emailTemplate.create({
          data: { key: String(p.key), name: String(p.name), subject: String(p.subject), body: String(p.body) },
        });
        break;
      }
      case 'view': {
        const exists = await prisma.savedView.findFirst({ where: { name: String(p.name) }, select: { id: true } });
        if (exists) return { error: 'Already installed.' };
        await prisma.savedView.create({
          data: { name: String(p.name), entity: String(p.entity), filters: (p.filters ?? {}) as object, ownerId: ctx.user.id, isShared: true },
        });
        break;
      }
      case 'fields': {
        const entity = String(p.entity);
        const list = (p.fields as Array<{ key: string; label: string; type: string; options?: string[] }>) ?? [];
        let order = await prisma.customFieldDef.count({ where: { entity } });
        for (const f of list) {
          const exists = await prisma.customFieldDef.findFirst({ where: { entity, key: f.key }, select: { id: true } });
          if (exists) continue;
          await prisma.customFieldDef.create({
            data: { entity, key: f.key, label: f.label, type: f.type, options: f.options ?? [], order: order++ },
          });
        }
        break;
      }
      case 'incentive': {
        const list = (p.slabs as Array<{ name: string; fromValue: number; toValue: number | null; ratePercent: number; flatAmount?: number }>) ?? [];
        for (const sl of list) {
          const exists = await prisma.incentiveSlab.findFirst({ where: { name: sl.name }, select: { id: true } });
          if (exists) continue;
          await prisma.incentiveSlab.create({
            data: { name: sl.name, fromValue: sl.fromValue, toValue: sl.toValue, ratePercent: sl.ratePercent, flatAmount: sl.flatAmount ?? null },
          });
        }
        break;
      }
    }

    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Setting', summary: `Installed extra: ${extra.name}` });
    revalidatePath('/admin/marketplace');
    revalidatePath('/admin/automations');
    revalidatePath('/admin/templates');
    return {
      ok: true,
      message: extra.kind === 'automation'
        ? 'Installed, switched off. Check it under Automations, then turn it on.'
        : 'Installed.',
    };
  } catch (err) { return toActionError(err); }
}

/** Take it back out. Anything you have since edited is left alone where we can tell. */
export async function uninstallExtra(id: string): Promise<MktResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const extra = EXTRAS.find((e) => e.id === id);
    if (!extra) return { error: 'That extra no longer exists.' };
    const p = extra.payload as Record<string, unknown>;

    switch (extra.kind) {
      case 'automation':
        await prisma.automationRule.deleteMany({ where: { name: String(p.name) } });
        break;
      case 'template':
        await prisma.emailTemplate.deleteMany({ where: { key: String(p.key) } });
        break;
      case 'view':
        await prisma.savedView.deleteMany({ where: { name: String(p.name) } });
        break;
      case 'fields': {
        const entity = String(p.entity);
        const keys = ((p.fields as Array<{ key: string }>) ?? []).map((f) => f.key);
        // Deactivate rather than delete — values already recorded against these
        // fields would otherwise become unreadable.
        await prisma.customFieldDef.updateMany({ where: { entity, key: { in: keys } }, data: { isActive: false } });
        break;
      }
      case 'incentive': {
        const names = ((p.slabs as Array<{ name: string }>) ?? []).map((s) => s.name);
        await prisma.incentiveSlab.updateMany({ where: { name: { in: names } }, data: { isActive: false } });
        break;
      }
    }

    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'Setting', summary: `Removed extra: ${extra.name}` });
    revalidatePath('/admin/marketplace');
    return { ok: true, message: extra.kind === 'fields' ? 'Removed from forms — existing values are kept.' : 'Removed.' };
  } catch (err) { return toActionError(err); }
}

'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { APP_PACKAGES, appPackageById, type AppPackage } from '@/config/app-packages';
import { installPackage, uninstallPackage } from '@/server/services/app-package-service';
import { ensure, toActionError } from './_helpers';

export type PkgResult = { ok: true; message?: string; json?: string } | { error: string };

const itemSchema = z.object({
  kind: z.enum(['automation', 'fields', 'view', 'template', 'connector']),
  payload: z.record(z.string(), z.unknown()),
});
const packageSchema = z.object({
  id: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/i, 'id must be letters, numbers and dashes'),
  name: z.string().min(2).max(80),
  publisher: z.string().max(60).default('Imported'),
  category: z.string().max(40).default('Custom'),
  description: z.string().max(400).default(''),
  items: z.array(itemSchema).min(1).max(50),
});

/**
 * Package ids currently installed.
 *
 * Gated for the same reason as `connectorInstalls`: an exported server action
 * is a POST endpoint regardless of which page imports it.
 */
export async function installedPackages(): Promise<Array<{ packageId: string; source: string }>> {
  try {
    await ensure('admin.setting.manage');
    const rows = await prisma.appPackageInstall.findMany({ select: { packageId: true, source: true } });
    return rows;
  } catch { return []; }
}

export async function installAppPackage(id: string): Promise<PkgResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const pkg = appPackageById(z.string().parse(id));
    if (!pkg) return { error: 'Unknown package.' };
    await installPackage(pkg, ctx.user.id, 'catalogue');
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'AppPackageInstall', summary: `Installed package ${pkg.name}` });
    revalidatePath('/admin/app-packages');
    return { ok: true, message: 'Installed. Any automations arrive switched off — review, then enable.' };
  } catch (err) { return toActionError(err); }
}

export async function uninstallAppPackage(packageId: string): Promise<PkgResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    await uninstallPackage(z.string().parse(packageId));
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'AppPackageInstall', summary: `Removed package ${packageId}` });
    revalidatePath('/admin/app-packages');
    return { ok: true, message: 'Removed. Custom-field values you already captured are kept.' };
  } catch (err) { return toActionError(err); }
}

/** Export a package (catalogue one, or your current setup) as shareable JSON. */
export async function exportAppPackage(id: string): Promise<PkgResult> {
  try {
    await ensure('admin.setting.manage');
    if (id === '__current__') {
      const [fields, autos] = await Promise.all([
        prisma.customFieldDef.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
        prisma.automationRule.findMany({ take: 100 }),
      ]);
      const byEntity: Record<string, Array<{ key: string; label: string; type: string; options: string[] }>> = {};
      for (const f of fields) (byEntity[f.entity] ??= []).push({ key: f.key, label: f.label, type: f.type, options: f.options });
      const pkg: AppPackage = {
        id: 'my-setup', name: 'My CRM setup', publisher: 'Exported', category: 'Custom',
        description: 'Custom fields and automations exported from this workspace.',
        items: [
          ...Object.entries(byEntity).map(([entity, fs]) => ({ kind: 'fields' as const, payload: { entity, fields: fs } })),
          ...autos.map((a) => ({ kind: 'automation' as const, payload: { name: a.name, description: a.description, trigger: a.trigger, conditions: a.conditions, actions: a.actions } })),
        ],
      };
      return { ok: true, json: JSON.stringify(pkg, null, 2) };
    }
    const pkg = appPackageById(id);
    if (!pkg) return { error: 'Unknown package.' };
    return { ok: true, json: JSON.stringify(pkg, null, 2) };
  } catch (err) { return toActionError(err); }
}

/** Import a package from pasted/uploaded JSON and install it. */
export async function importAppPackage(json: string): Promise<PkgResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    let parsed: unknown;
    try { parsed = JSON.parse(json); } catch { return { error: 'That is not valid JSON.' }; }
    const pkg = packageSchema.parse(parsed) as AppPackage;
    // Namespace an imported id so it can't clobber a catalogue package.
    if (APP_PACKAGES.some((p) => p.id === pkg.id)) pkg.id = `imported-${pkg.id}`;
    await installPackage(pkg, ctx.user.id, 'imported');
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'AppPackageInstall', summary: `Imported package ${pkg.name}` });
    revalidatePath('/admin/app-packages');
    return { ok: true, message: `Imported "${pkg.name}". Review its automations before enabling them.` };
  } catch (err) { return toActionError(err); }
}

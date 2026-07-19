'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { RoleName } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type ConfigResult = { ok: true } | { error: string };

/** Replace a role's permission grants (ALLOW) with the given set. */
export async function setRolePermissions(role: RoleName, allowedKeys: string[]): Promise<ConfigResult> {
  try {
    const ctx = await ensure('admin.role.manage');
    if (role === 'SUPER_ADMIN') return { error: 'Super Admin always has full access and cannot be restricted.' };
    const perms = await prisma.permission.findMany({ select: { id: true, key: true } });
    const idByKey = new Map(perms.map((p) => [p.key, p.id]));
    const data = allowedKeys
      .map((k) => idByKey.get(k))
      .filter((id): id is string => Boolean(id))
      .map((permissionId) => ({ role, permissionId, effect: 'ALLOW' as const }));
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { role } }),
      prisma.rolePermission.createMany({ data }),
    ]);
    await writeAudit({ actorId: ctx.user.id, action: 'PERMISSION_CHANGE', entityType: 'Role', entityId: role, summary: `Set ${data.length} permissions on ${role}` });
    revalidatePath('/admin/permissions');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

const editSchema = z.object({ id: z.string(), name: z.string().min(1), subject: z.string().min(1), body: z.string().min(1), isActive: z.boolean().default(true) });
export async function updateEmailTemplate(input: unknown): Promise<ConfigResult> {
  try {
    const ctx = await ensure('email.template.manage');
    const d = editSchema.parse(input);
    await prisma.emailTemplate.update({ where: { id: d.id }, data: { name: d.name, subject: d.subject, body: d.body, isActive: d.isActive } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'EmailTemplate', entityId: d.id, summary: `Edited template ${d.name}` });
    revalidatePath('/admin/templates');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

const createSchema = z.object({
  key: z.string().min(2).regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers and underscores only'),
  name: z.string().min(1), subject: z.string().min(1), body: z.string().min(1),
});
export async function createEmailTemplate(input: unknown): Promise<ConfigResult> {
  try {
    const ctx = await ensure('email.template.manage');
    const d = createSchema.parse(input);
    if (await prisma.emailTemplate.findUnique({ where: { key: d.key } })) return { error: 'A template with that key already exists.' };
    await prisma.emailTemplate.create({ data: { key: d.key, name: d.name, subject: d.subject, body: d.body } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'EmailTemplate', summary: `Created template ${d.key}` });
    revalidatePath('/admin/templates');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Branding overrides stored in Setting (read by getBranding()). */
const brandingSchema = z.object({
  displayName: z.string().max(60).optional(),
  tagline: z.string().max(120).optional(),
  primaryColor: z.string().regex(/^#([0-9a-fA-F]{6})$/, 'Use a hex colour like #A07D34').optional().or(z.literal('')),
  supportEmail: z.string().email().optional().or(z.literal('')),
});
export async function updateBranding(input: unknown): Promise<ConfigResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const d = brandingSchema.parse(input);
    const entries: Array<[string, string]> = [];
    if (d.displayName) entries.push(['branding.displayName', d.displayName]);
    if (d.tagline) entries.push(['branding.tagline', d.tagline]);
    if (d.primaryColor) entries.push(['branding.primaryColor', d.primaryColor]);
    if (d.supportEmail) entries.push(['branding.supportEmail', d.supportEmail]);
    for (const [key, value] of entries) {
      await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Setting', summary: 'Updated branding' });
    revalidatePath('/admin/branding');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

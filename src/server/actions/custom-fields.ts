'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type FieldResult = { ok: true; id?: string } | { error: string };
const TYPES = ['text', 'number', 'date', 'select', 'checkbox'] as const;

const defSchema = z.object({
  entity: z.string().default('lead'),
  key: z.string().min(2).max(40).regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscore only'),
  label: z.string().min(2).max(60),
  type: z.enum(TYPES).default('text'),
  options: z.string().max(500).optional(),
  required: z.coerce.boolean().default(false),
  order: z.coerce.number().int().min(0).max(999).default(0),
});

export async function createCustomField(input: unknown): Promise<FieldResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const d = defSchema.parse(input);
    const exists = await prisma.customFieldDef.findFirst({ where: { entity: d.entity, key: d.key } });
    if (exists) return { error: `A field with key "${d.key}" already exists.` };
    const f = await prisma.customFieldDef.create({
      data: { entity: d.entity, key: d.key, label: d.label, type: d.type, required: d.required, order: d.order, options: d.options ? d.options.split(',').map((o) => o.trim()).filter(Boolean) : [] },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'CustomFieldDef', entityId: f.id, summary: `Added custom field ${d.label}` });
    revalidatePath('/admin/fields'); revalidatePath('/sales');
    return { ok: true, id: f.id };
  } catch (err) { return toActionError(err); }
}

export async function toggleCustomField(id: string, isActive: boolean): Promise<FieldResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    await prisma.customFieldDef.update({ where: { id }, data: { isActive } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'CustomFieldDef', entityId: id, summary: `Field ${isActive ? 'enabled' : 'disabled'}` });
    revalidatePath('/admin/fields'); revalidatePath('/sales');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function deleteCustomField(id: string): Promise<FieldResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    await prisma.customFieldDef.delete({ where: { id } });
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'CustomFieldDef', entityId: id, summary: 'Deleted custom field' });
    revalidatePath('/admin/fields'); revalidatePath('/sales');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Save custom-field values on a lead (stored as JSON). */
export async function setLeadCustomFields(leadId: string, values: Record<string, unknown>): Promise<FieldResult> {
  try {
    const ctx = await ensure('lead.update');
    await prisma.lead.update({ where: { id: leadId }, data: { customFields: values as object } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Lead', entityId: leadId, summary: 'Updated custom fields' });
    revalidatePath(`/sales/${leadId}`);
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

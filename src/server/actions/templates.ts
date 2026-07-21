'use server';
import { z } from 'zod';
import { fetchWithTimeout } from '@/lib/utils/fetch-timeout';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { validate, toMetaPayload, type TemplateInput } from '@/lib/templates/engine';
import { decrypt } from '@/lib/utils/crypto';

export type TemplateResult = { ok: true; id: string; message: string } | { error: string };

const buttonSchema = z.object({
  type: z.enum(['QUICK_REPLY', 'URL']),
  text: z.string().min(1).max(40),
  url: z.string().max(500).optional().or(z.literal('')),
});

const schema = z.object({
  id: z.string().optional().or(z.literal('')),
  key: z.string().min(2).max(120),
  name: z.string().min(2).max(160),
  channel: z.enum(['EMAIL', 'WHATSAPP', 'SMS', 'LETTER']),
  category: z.string().optional().or(z.literal('')),
  language: z.string().max(10).default('en'),
  subject: z.string().max(300).optional().or(z.literal('')),
  header: z.string().max(300).optional().or(z.literal('')),
  body: z.string().min(1).max(5000),
  footer: z.string().max(300).optional().or(z.literal('')),
  buttons: z.array(buttonSchema).max(3).optional(),
  description: z.string().max(500).optional().or(z.literal('')),
  departmentId: z.string().optional().nullable().or(z.literal('')),
});

/** Create or update a template. Validation runs server-side too — the browser is not the gate. */
export async function saveTemplate(input: unknown): Promise<TemplateResult> {
  try {
    const ctx = await ensure('email.template.manage');
    const d = schema.parse(input);

    const asInput: TemplateInput = {
      key: d.key, channel: d.channel, category: d.category || null,
      subject: d.subject || null, header: d.header || null, body: d.body,
      footer: d.footer || null,
      buttons: (d.buttons ?? []).map((b) => ({ type: b.type, text: b.text, url: b.url || undefined })),
    };
    const errors = validate(asInput).filter((i) => i.level === 'error');
    if (errors.length) return { error: errors[0]!.message };

    const clash = await prisma.messageTemplate.findFirst({
      where: { key: d.key, ...(d.id ? { id: { not: d.id } } : {}) },
      select: { id: true, name: true },
    });
    if (clash) return { error: `The name "${d.key}" is already used by "${clash.name}". Names must be unique.` };

    const data = {
      key: d.key, name: d.name, channel: d.channel, category: d.category || null,
      language: d.language || 'en', subject: d.subject || null, header: d.header || null,
      body: d.body, footer: d.footer || null,
      buttons: d.buttons?.length ? (d.buttons as unknown as object) : undefined,
      description: d.description || null,
      departmentId: d.departmentId || null,
    };

    let id: string;
    if (d.id) {
      const before = await prisma.messageTemplate.findUnique({ where: { id: d.id }, select: { metaStatus: true, body: true } });
      // Changing an approved WhatsApp template means Meta must approve it again.
      const reset = before?.metaStatus === 'APPROVED' && before.body !== d.body ? { metaStatus: 'DRAFT', metaTemplateId: null } : {};
      const t = await prisma.messageTemplate.update({ where: { id: d.id }, data: { ...data, ...reset } });
      id = t.id;
    } else {
      const t = await prisma.messageTemplate.create({
        data: { ...data, createdById: ctx.user.id, metaStatus: d.channel === 'WHATSAPP' ? 'DRAFT' : null },
      });
      id = t.id;
    }

    await writeAudit({ actorId: ctx.user.id, action: d.id ? 'UPDATE' : 'CREATE', entityType: 'MessageTemplate', entityId: id, summary: `${d.id ? 'Updated' : 'Created'} ${d.channel} template "${d.name}"` });
    revalidatePath('/admin/message-templates');
    return { ok: true, id, message: `"${d.name}" saved.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteTemplate(id: string): Promise<TemplateResult> {
  try {
    const ctx = await ensure('email.template.manage');
    const t = await prisma.messageTemplate.findUnique({ where: { id }, select: { name: true } });
    if (!t) return { error: 'That template no longer exists.' };
    await prisma.messageTemplate.delete({ where: { id } });
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'MessageTemplate', entityId: id, summary: `Deleted template "${t.name}"` });
    revalidatePath('/admin/message-templates');
    return { ok: true, id, message: `"${t.name}" deleted.` };
  } catch (e) {
    return toActionError(e);
  }
}

export type SubmitResult = { ok: true; message: string } | { error: string; payload?: string };

/**
 * Send a WhatsApp template to Meta for approval. If WhatsApp is not connected
 * yet, hand back the exact JSON so it can be pasted into Meta Business Manager
 * by hand — the work of writing the template is not wasted either way.
 */
export async function submitToMeta(id: string): Promise<SubmitResult> {
  try {
    const ctx = await ensure('email.template.manage');
    const t = await prisma.messageTemplate.findUnique({ where: { id } });
    if (!t) return { error: 'That template no longer exists.' };
    if (t.channel !== 'WHATSAPP') return { error: 'Only WhatsApp templates need Meta approval.' };

    const asInput: TemplateInput = {
      key: t.key, channel: t.channel, category: t.category, subject: t.subject,
      header: t.header, body: t.body, footer: t.footer,
      buttons: (t.buttons as TemplateInput['buttons']) ?? null,
    };
    const errors = validate(asInput).filter((i) => i.level === 'error');
    if (errors.length) return { error: `Fix this first: ${errors[0]!.message}` };

    const { payload } = toMetaPayload(asInput, t.language);
    const conn = await prisma.integrationConnection.findUnique({ where: { provider: 'whatsapp' } });
    const wabaId = (conn?.meta as { wabaId?: string } | null)?.wabaId;

    if (!conn || conn.status !== 'CONNECTED' || !conn.accessToken || !wabaId) {
      await prisma.messageTemplate.update({ where: { id }, data: { metaStatus: 'DRAFT' } });
      return {
        error: 'WhatsApp is not connected yet, so I cannot submit this for you. Copy the JSON below into Meta Business Manager, or connect WhatsApp in Admin > Connected Accounts and press this again.',
        payload: JSON.stringify(payload, null, 2),
      };
    }

    const res = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${wabaId}/message_templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${decrypt(conn.accessToken)}` },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) {
      await prisma.messageTemplate.update({ where: { id }, data: { metaStatus: 'REJECTED', metaRejection: text.slice(0, 400) } });
      return { error: `Meta refused it (HTTP ${res.status}): ${text.slice(0, 200)}`, payload: JSON.stringify(payload, null, 2) };
    }
    const out = JSON.parse(text) as { id?: string; status?: string };
    await prisma.messageTemplate.update({
      where: { id },
      data: { metaStatus: out.status ?? 'PENDING', metaTemplateId: out.id ?? null, submittedAt: new Date(), metaRejection: null },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'MessageTemplate', entityId: id, summary: `Submitted "${t.name}" to Meta` });
    revalidatePath('/admin/message-templates');
    return { ok: true, message: 'Submitted. Meta usually reviews within a few hours; this page will show the result.' };
  } catch (e) {
    return toActionError(e);
  }
}

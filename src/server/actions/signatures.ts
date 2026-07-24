'use server';
import { z } from 'zod';
import { fetchWithTimeout } from '@/lib/utils/fetch-timeout';
import { randomBytes } from 'node:crypto';
import { addDays } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { sendEmail } from '@/lib/email/email';
import { putObject } from '@/lib/storage/storage';
import { notifyMany } from '@/lib/notifications/notify';
import { writeAudit } from '@/lib/audit/log';
import { checkRate, callerIp } from '@/lib/security/rate-limit';
import { ensure, toActionError } from '@/server/actions/_helpers';

export type SigResult = { ok: true; link?: string; emailed?: boolean; id?: string } | { error: string };

const baseUrl = () => env.APP_URL.replace(/\/$/, '');

const schema = z.object({
  title: z.string().min(2).max(160),
  fileUrl: z.string().min(4),
  signerName: z.string().min(2).max(120),
  signerEmail: z.string().email().optional().or(z.literal('')),
  signerPhone: z.string().max(20).optional().or(z.literal('')),
  message: z.string().max(600).optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  expiryDays: z.coerce.number().min(1).max(90).default(14),
});

export async function createSignatureRequest(input: unknown): Promise<SigResult> {
  try {
    const ctx = await ensure('document.manage');
    const d = schema.parse(input);
    const token = randomBytes(24).toString('hex');
    const count = await prisma.signatureRequest.count();
    const reference = `SIG-${1001 + count}`;

    const sr = await prisma.signatureRequest.create({
      data: {
        reference, title: d.title, fileUrl: d.fileUrl,
        signerName: d.signerName,
        signerEmail: d.signerEmail || null,
        signerPhone: d.signerPhone || null,
        message: d.message || null,
        entityType: d.entityType || null, entityId: d.entityId || null,
        requestedById: ctx.user.id, requestedByName: ctx.user.name,
        token, expiresAt: addDays(new Date(), d.expiryDays),
      },
    });

    const link = `${baseUrl()}/sign/${token}`;
    let emailed = false;
    if (d.signerEmail) {
      const res = await sendEmail({
        to: [d.signerEmail],
        subject: `Signature requested: ${d.title}`,
        text: [
          `Dear ${d.signerName},`, '',
          `${ctx.user.name} has asked you to sign "${d.title}".`,
          d.message ? `\n${d.message}` : '',
          '', 'Read the document and sign it here:', link,
          '', `This link expires in ${d.expiryDays} days. Reference: ${reference}.`,
          '', '— Ameya Heights LLP',
        ].filter(Boolean).join('\n'),
      });
      emailed = res.ok;
    }

    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Document', entityId: sr.id, summary: `Sent ${reference} to ${d.signerName} for signature` });
    revalidatePath('/documents');
    return { ok: true, id: sr.id, link, emailed };
  } catch (err) { return toActionError(err); }
}

/** Called from the public signing page. Stamps the PDF and records who signed, from where. */
export async function submitSignature(token: string, signatureDataUrl: string, typedName: string): Promise<SigResult> {
  try {
    const sr = await prisma.signatureRequest.findUnique({ where: { token } });
    if (!sr) return { error: 'This signing link is not valid.' };
    if (sr.status === 'SIGNED') return { error: 'This document has already been signed.' };
    if (sr.expiresAt && sr.expiresAt < new Date()) return { error: 'This signing link has expired. Ask for a fresh one.' };
    if (!signatureDataUrl.startsWith('data:image/png;base64,')) return { error: 'Please draw your signature before submitting.' };

    const { headers } = await import('next/headers');
    const h = await headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const ua = h.get('user-agent')?.slice(0, 300) ?? null;

    let signedFileUrl: string | null = null;
    try {
      const src = await fetchWithTimeout(sr.fileUrl);
      if (src.ok) {
        const pdf = await PDFDocument.load(await src.arrayBuffer());
        const base64 = signatureDataUrl.split(',')[1];
        if (!base64) return { error: 'That signature image could not be read. Please draw it again.' };
        const png = await pdf.embedPng(Buffer.from(base64, 'base64'));
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const page = pdf.getPages()[pdf.getPageCount() - 1];
        if (!page) return { error: 'That PDF has no pages to sign.' };
        const { width } = page.getSize();
        const w = 160;
        const h2 = (png.height / png.width) * w;

        page.drawRectangle({ x: width - w - 60, y: 52, width: w + 20, height: h2 + 54, color: rgb(1, 1, 1), borderColor: rgb(0.78, 0.72, 0.6), borderWidth: 0.8 });
        page.drawImage(png, { x: width - w - 50, y: 74, width: w, height: h2 });
        page.drawText(`Signed by ${typedName || sr.signerName}`, { x: width - w - 50, y: 66, size: 7, font, color: rgb(0.25, 0.22, 0.18) });
        page.drawText(`${new Date().toLocaleString('en-IN')} · ${sr.reference}${ip ? ` · ${ip}` : ''}`, { x: width - w - 50, y: 57, size: 6, font, color: rgb(0.45, 0.42, 0.36) });

        const bytes = Buffer.from(await pdf.save());
        const stored = await putObject(`signed/${sr.reference}-${Date.now()}.pdf`, bytes, 'application/pdf');
        signedFileUrl = stored.key;
      }
    } catch {
      // If stamping fails we still record the signature — the audit trail is what binds it.
    }

    await prisma.signatureRequest.update({
      where: { id: sr.id },
      data: {
        status: 'SIGNED', signedAt: new Date(), signatureData: signatureDataUrl.slice(0, 200000),
        signerIp: ip, signerUserAgent: ua, signedFileUrl,
      },
    });

    if (sr.requestedById) {
      await notifyMany([sr.requestedById], {
        type: 'DOCUMENT', title: 'Document signed',
        body: `${sr.signerName} has signed "${sr.title}" (${sr.reference}).`,
        link: '/documents',
      });
    }
    await sendEmail({
      to: [sr.signerEmail].filter(Boolean) as string[],
      subject: `Signed: ${sr.title}`,
      text: `Thank you. Your signature on "${sr.title}" (${sr.reference}) was recorded on ${new Date().toLocaleString('en-IN')}.\n\n— Ameya Heights LLP`,
    }).catch(() => undefined);

    await writeAudit({ actorId: sr.requestedById ?? undefined, action: 'UPDATE', entityType: 'Document', entityId: sr.id, summary: `${sr.signerName} signed ${sr.reference} from ${ip ?? 'unknown IP'}` });
    revalidatePath('/documents');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function declineSignature(token: string, reason: string): Promise<SigResult> {
  try {
    const sr = await prisma.signatureRequest.findUnique({ where: { token } });
    if (!sr) return { error: 'This signing link is not valid.' };
    await prisma.signatureRequest.update({ where: { id: sr.id }, data: { status: 'DECLINED', declineReason: reason.slice(0, 500) } });
    if (sr.requestedById) {
      await notifyMany([sr.requestedById], { type: 'DOCUMENT', title: 'Signature declined', body: `${sr.signerName} declined "${sr.title}". Reason: ${reason.slice(0, 160)}`, link: '/documents' });
    }
    revalidatePath('/documents');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function cancelSignatureRequest(id: string): Promise<SigResult> {
  try {
    const ctx = await ensure('document.manage');
    await prisma.signatureRequest.update({ where: { id }, data: { status: 'EXPIRED', expiresAt: new Date() } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Document', entityId: id, summary: 'Cancelled a signature request' });
    revalidatePath('/documents');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

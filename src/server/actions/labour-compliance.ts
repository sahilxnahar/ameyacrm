'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type CompResult = { ok: true } | { error: string };

/** Flag / unflag a vendor as a labour vendor whose payments require EPF/ESI. */
export async function setVendorLabourCompliance(vendorId: string, requires: boolean): Promise<CompResult> {
  try {
    const ctx = await ensure('procurement.manage');
    const id = z.string().min(1).parse(vendorId);
    await prisma.vendor.update({ where: { id }, data: { requiresLabourCompliance: requires } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Vendor', entityId: id, summary: requires ? 'Marked as labour vendor (EPF/ESI gated)' : 'Removed labour-compliance gate' });
    revalidatePath('/labour-compliance');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

const recordSchema = z.object({
  vendorId: z.string().min(1),
  kind: z.enum(['EPF', 'ESI', 'OTHER']),
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/),
  challanNo: z.string().max(60).optional(),
  amount: z.coerce.number().min(0).optional(),
  verified: z.boolean().default(false),
  note: z.string().max(300).optional(),
});

/** Record (or update) a monthly EPF/ESI challan for a vendor, optionally verifying it. */
export async function recordComplianceDoc(input: unknown): Promise<CompResult> {
  try {
    const ctx = await ensure('procurement.manage');
    const d = recordSchema.parse(input);
    const status = d.verified ? 'VERIFIED' : d.challanNo ? 'UPLOADED' : 'PENDING';
    await prisma.complianceDoc.upsert({
      where: { vendorId_kind_periodMonth: { vendorId: d.vendorId, kind: d.kind, periodMonth: d.periodMonth } },
      update: {
        challanNo: d.challanNo || null, amount: d.amount ?? null, note: d.note || null, status,
        uploadedById: ctx.user.id, ...(d.verified ? { verifiedById: ctx.user.id, verifiedAt: new Date() } : {}),
      },
      create: {
        vendorId: d.vendorId, kind: d.kind, periodMonth: d.periodMonth, challanNo: d.challanNo || null,
        amount: d.amount ?? null, note: d.note || null, status, uploadedById: ctx.user.id,
        ...(d.verified ? { verifiedById: ctx.user.id, verifiedAt: new Date() } : {}),
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'ComplianceDoc', summary: `${d.kind} challan ${d.periodMonth} recorded (${status})` });
    revalidatePath('/labour-compliance');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Verify a recorded challan (releases the payment gate for that vendor/month). */
export async function verifyComplianceDoc(id: string): Promise<CompResult> {
  try {
    const ctx = await ensure('procurement.manage');
    const docId = z.string().min(1).parse(id);
    await prisma.complianceDoc.update({ where: { id: docId }, data: { status: 'VERIFIED', verifiedById: ctx.user.id, verifiedAt: new Date() } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'ComplianceDoc', entityId: docId, summary: 'Verified challan' });
    revalidatePath('/labour-compliance');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

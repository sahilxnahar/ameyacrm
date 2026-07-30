'use server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type VendorPortalResult = { ok: true; token: string } | { error: string };

/**
 * Create (or rotate) a vendor's secret portal link. Rotating invalidates the old
 * one, so a link can be revoked by generating a fresh one. Admin/billing only.
 */
export async function generateVendorPortalToken(vendorId: string): Promise<VendorPortalResult> {
  try {
    const ctx = await ensure('billing.bill.manage');
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, name: true } });
    if (!vendor) return { error: 'That vendor no longer exists.' };
    const token = randomBytes(24).toString('base64url');
    await prisma.vendorPortalAccess.upsert({ where: { vendorId }, update: { token, tokenExpiresAt: new Date(Date.now() + 90*864e5) }, create: { vendorId, token, tokenExpiresAt: new Date(Date.now() + 90*864e5) } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Vendor', entityId: vendorId, summary: `Generated a portal link for ${vendor.name}` });
    return { ok: true, token };
  } catch (e) { return toActionError(e); }
}

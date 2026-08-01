'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { writeAudit } from '@/lib/audit/log';
import { prisma } from '@/lib/db/prisma';
import { nextReference } from '@/lib/utils/reference';

const schema = z.object({
  token: z.string().min(10),
  name: z.string().min(2, 'Client name is required').max(160),
  phone: z.string().min(5, 'Phone is required').max(30),
  email: z.string().email().optional().or(z.literal('')),
  requirement: z.string().max(500).optional(),
});

/**
 * Public: a channel partner registers a lead from their portal. Auth is the
 * unguessable portal token. Anti-poaching is enforced here just like the internal
 * flow — if the client is already locked to another CP, registration is refused.
 */
export async function cpRegisterLead(input: unknown): Promise<{ ok: true } | { error: string }> {
  try {
    const d = schema.parse(input);
    const cp = await prisma.channelPartner.findUnique({ where: { portalToken: d.token }, select: { id: true, status: true, firmName: true, portalTokenExpiresAt: true } });
    if (!cp || cp.status === 'SUSPENDED' || (cp.portalTokenExpiresAt && cp.portalTokenExpiresAt < new Date())) return { error: 'This partner portal link is invalid, expired or has been suspended.' };

    const email = d.email ? d.email.toLowerCase() : null;
    const existing = await prisma.lead.findFirst({
      where: { deletedAt: null, OR: [{ phone: d.phone }, ...(email ? [{ email }] : [])] },
      select: { id: true, channelPartnerId: true, cpLockedUntil: true },
    });
    if (existing?.channelPartnerId && existing.channelPartnerId !== cp.id && existing.cpLockedUntil && existing.cpLockedUntil > new Date()) {
      return { error: 'This client is already registered by another channel partner. Please contact the sales office.' };
    }

    const lockUntil = new Date(Date.now() + 60 * 864e5);
    let leadId: string;
    let claimedExisting = false;

    if (existing) {
      // Claiming a lead the office already had. This changes who earns the
      // commission, so it is recorded rather than applied silently — previously
      // an in-house WEBSITE lead could quietly become a commissionable BROKER
      // lead with nothing written down anywhere.
      await prisma.lead.update({
        where: { id: existing.id },
        data: { channelPartnerId: cp.id, cpLockedUntil: lockUntil, source: 'BROKER' },
      });
      leadId = existing.id;
      claimedExisting = true;
      await prisma.leadActivity.create({
        data: {
          leadId, type: 'NOTE',
          subject: `Registered by channel partner ${cp.firmName}`,
          notes: `${cp.firmName} registered this existing lead through the partner portal, so it is now marked as a broker lead and locked to them until ${lockUntil.toLocaleDateString('en-IN')}. Check this is right before paying commission.`,
        },
      }).catch(() => undefined);
      await writeAudit({
        action: 'UPDATE', entityType: 'Lead', entityId: leadId,
        summary: `Channel partner ${cp.firmName} claimed an existing lead — source changed to BROKER, locked until ${lockUntil.toISOString().slice(0, 10)}`,
      }).catch(() => undefined);
    } else {
      const reference = await nextReference('LEAD');
      const lead = await prisma.lead.create({
        data: { reference, name: d.name, phone: d.phone, email, source: 'BROKER', requirement: d.requirement || null, channelPartnerId: cp.id, cpLockedUntil: lockUntil },
        select: { id: true, name: true, status: true, score: true },
      });
      leadId = lead.id;
      await prisma.leadActivity.create({
        data: { leadId, type: 'NOTE', subject: `Registered by channel partner ${cp.firmName}`, notes: d.requirement || null },
      }).catch(() => undefined);
      // Every other capture path fires this; the partner portal did not, so a
      // broker registration was the one enquiry that skipped assignment rules.
      const { runAutomations } = await import('@/lib/automation/engine');
      await runAutomations('LEAD_CREATED', {
        entityType: 'Lead', entityId: leadId,
        data: { name: lead.name, email, phone: d.phone, source: 'BROKER', status: lead.status, score: lead.score },
      }).catch(() => undefined);
    }

    // Tell the sales office. A broker registering a buyer with nobody informed
    // is how a registration sits unnoticed until the broker chases it.
    const managers = await prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null, role: { in: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'MANAGER'] } },
      select: { id: true }, take: 10,
    }).catch(() => []);
    const { notifyMany } = await import('@/lib/notifications/notify');
    await notifyMany(managers.map((m) => m.id), {
      type: 'SYSTEM',
      title: claimedExisting
        ? `${cp.firmName} claimed an existing lead — check before paying commission`
        : `${cp.firmName} registered a new client`,
      body: `${d.name}${d.requirement ? ` — ${d.requirement}` : ''}`,
      link: `/sales/${leadId}`,
    }).catch(() => undefined);

    revalidatePath(`/cp/${d.token}`);
    return { ok: true };
  } catch {
    return { error: 'Could not register this client. Please check the details and try again.' };
  }
}

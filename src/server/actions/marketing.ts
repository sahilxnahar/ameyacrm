'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { CampaignStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type MktResult = { ok: true; id: string } | { error: string };
const CHANNELS = ['META', 'GOOGLE', 'LINKEDIN', 'YOUTUBE', 'WHATSAPP', 'EMAIL', 'OFFLINE', 'OTHER'] as const;

const campaignSchema = z.object({
  name: z.string().min(2).max(160),
  channel: z.enum(CHANNELS).default('META'),
  objective: z.string().max(300).optional(),
  budget: z.coerce.number().nonnegative().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
});

export async function createCampaign(input: unknown): Promise<MktResult> {
  try {
    const ctx = await ensure('marketing.manage');
    const d = campaignSchema.parse(input);
    const c = await prisma.campaign.create({
      data: {
        name: d.name, channel: d.channel, objective: d.objective || null,
        budget: d.budget ?? null, startDate: d.startDate ? new Date(d.startDate) : null,
        endDate: d.endDate ? new Date(d.endDate) : null, projectId: d.projectId || null, ownerId: ctx.user.id,
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Campaign', entityId: c.id, summary: `Created campaign ${d.name}` });
    revalidatePath('/marketing');
    return { ok: true, id: c.id };
  } catch (err) { return toActionError(err); }
}

export async function updateCampaignStatus(id: string, status: CampaignStatus): Promise<MktResult> {
  try {
    const ctx = await ensure('marketing.manage');
    await prisma.campaign.update({ where: { id }, data: { status } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Campaign', entityId: id, summary: `Status → ${status}` });
    revalidatePath('/marketing');
    return { ok: true, id };
  } catch (err) { return toActionError(err); }
}

const postSchema = z.object({
  title: z.string().min(2).max(200),
  content: z.string().max(2000).optional(),
  channel: z.enum(CHANNELS).default('META'),
  scheduledAt: z.string().optional().nullable(),
});
export async function createSocialPost(input: unknown): Promise<MktResult> {
  try {
    const ctx = await ensure('marketing.manage');
    const d = postSchema.parse(input);
    const post = await prisma.socialPost.create({
      data: {
        title: d.title, content: d.content || null, channel: d.channel,
        status: d.scheduledAt ? 'SCHEDULED' : 'DRAFT', scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null,
        createdById: ctx.user.id,
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'SocialPost', entityId: post.id, summary: `Planned post ${d.title}` });
    revalidatePath('/marketing');
    return { ok: true, id: post.id };
  } catch (err) { return toActionError(err); }
}

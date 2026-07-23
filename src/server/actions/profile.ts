'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getActionContext, toActionError } from './_helpers';

export type ProfileResult = { ok: true } | { error: string };

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  phone: z.string().trim().max(24).optional().nullable(),
  whatsappNumber: z.string().trim().max(24).optional().nullable(),
  designation: z.string().trim().max(120).optional().nullable(),
  avatarUrl: z.string().trim().optional().nullable(),
});

/** Update your own profile — name, phone, WhatsApp, designation and photo. */
export async function updateMyProfile(input: unknown): Promise<ProfileResult> {
  try {
    const ctx = await getActionContext();
    const d = schema.parse(input);
    await prisma.user.update({
      where: { id: ctx.user.id },
      data: {
        name: d.name,
        phone: d.phone ? d.phone : null,
        whatsappNumber: d.whatsappNumber ? d.whatsappNumber : null,
        designation: d.designation ? d.designation : null,
        avatarUrl: d.avatarUrl ? d.avatarUrl : null,
      },
    });
    revalidatePath('/settings/profile');
    revalidatePath('/');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

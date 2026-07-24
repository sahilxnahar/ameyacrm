'use server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { getActionContext, toActionError } from './_helpers';

export type FeedbackResult = { ok: true } | { error: string };

const schema = z.object({
  message: z.string().trim().min(3, 'Tell us a little more.').max(2000),
  rating: z.string().trim().max(10).optional(),
  path: z.string().trim().max(300).optional(),
});

/** Anyone signed in can leave feedback. It lands in a table admins can read. */
export async function sendFeedback(input: unknown): Promise<FeedbackResult> {
  try {
    const ctx = await getActionContext();
    const d = schema.parse(input);
    await prisma.feedback.create({
      data: { userId: ctx.user.id, message: d.message, rating: d.rating || null, path: d.path || null },
    });
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

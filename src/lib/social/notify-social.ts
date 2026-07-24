import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { notifyMany } from '@/lib/notifications/notify';
import { summarizeSocialActivity } from '@/lib/ai/gemini';

const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: 'WhatsApp', LINKEDIN: 'LinkedIn', INSTAGRAM: 'Instagram', FACEBOOK: 'Facebook',
  TWITTER: 'X', YOUTUBE: 'YouTube', GOOGLE: 'Google', WEBSITE: 'Website', OTHER: 'Social',
};

/**
 * Write a one-line AI brief onto a social activity and push it to the people
 * who are allowed to see marketing data. Never throws — a failed summary must
 * not lose the activity itself.
 */
export async function announceSocialActivity(activityId: string): Promise<void> {
  try {
    const a = await prisma.socialActivity.findUnique({ where: { id: activityId } });
    if (!a || a.notifiedAt) return;

    const brief = await summarizeSocialActivity({
      channel: a.channel, kind: a.kind, name: a.name, handle: a.handle, message: a.message,
    });

    const label = CHANNEL_LABEL[a.channel] ?? 'Social';
    const who = a.name || a.handle || 'Someone';
    const fallback = `${who} — ${a.kind} on ${label}${a.message ? `: ${a.message.slice(0, 120)}` : ''}`;
    const summary = brief?.summary || fallback;

    await prisma.socialActivity.update({
      where: { id: a.id },
      data: { summary, notifiedAt: new Date() },
    });

    // Only people who can see marketing get told.
    const recipients = await prisma.user.findMany({
      where: {
        status: 'ACTIVE', deletedAt: null,
        role: { in: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'MANAGER'] },
      },
      select: { id: true },
    });
    if (!recipients.length) return;

    const prefix = brief?.importance === 'high' ? '🔥 ' : '';
    await notifyMany(recipients.map((r) => r.id), {
      type: 'SYSTEM',
      title: `${prefix}New on ${label}`,
      body: summary,
      link: a.leadId ? `/sales?lead=${a.leadId}` : '/marketing',
    });
  } catch {
    /* notification is best-effort; the activity is already saved */
  }
}

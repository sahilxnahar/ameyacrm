'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';

export type AppResult = { ok: true; message?: string } | { error: string };

/** Where the Android build lives. Anything reachable works — Blob, Drive, your own server. */
export async function saveApkUrl(url: string): Promise<AppResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const v = url.trim();
    if (v && !/^https?:\/\//i.test(v)) return { error: 'The link must start with http:// or https://' };
    await prisma.setting.upsert({ where: { key: 'app.apkUrl' }, update: { value: v }, create: { key: 'app.apkUrl', value: v } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Setting', summary: v ? 'Set the Android app download link' : 'Removed the Android app download link' });
    revalidatePath('/install');
    revalidatePath('/login');
    revalidatePath('/admin/mobile-app');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Stop nagging one person about one item for a while. */
export async function snoozeOverdueNotice(id: string, hours: number): Promise<AppResult> {
  try {
    const ctx = await ensure('admin.user.manage');
    await prisma.overdueNotice.update({
      where: { id },
      data: { snoozedUntil: new Date(Date.now() + hours * 3600_000) },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Setting', entityId: id, summary: `Snoozed an overdue reminder for ${hours}h` });
    revalidatePath('/admin/mobile-app');
    return { ok: true, message: `Quiet for ${hours} hours.` };
  } catch (err) { return toActionError(err); }
}

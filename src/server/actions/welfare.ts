'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { REQUIRED_WELFARE } from '@/server/services/welfare-service';
import { ensure, toActionError } from './_helpers';

export interface WelfareInput { projectId: string; category: string; headcount?: number | null; note?: string | null; photoUrl?: string | null }
export async function logWelfare(input: WelfareInput): Promise<{ ok: true } | { error: string }> {
  try {
    const ctx = await ensure('procurement.manage');
    if (!input.projectId) return { error: 'Project is required.' };
    const category = (REQUIRED_WELFARE as readonly string[]).includes(input.category) ? input.category : 'DRINKING_WATER';
    await prisma.welfareLog.create({
      data: { projectId: input.projectId, category, headcount: input.headcount != null && Number.isFinite(input.headcount) ? Math.trunc(input.headcount) : null, note: input.note?.trim() || null, photoUrl: input.photoUrl?.trim() || null, loggedById: ctx.user.id },
    });
    await writeAudit({ action: 'CREATE', entityType: 'WelfareLog', entityId: input.projectId, summary: `Welfare logged: ${category}` });
    revalidatePath('/welfare-log');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

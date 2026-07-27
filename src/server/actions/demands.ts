'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { runDemandCycle, dispatchPendingDemands, type DemandRun } from '@/server/services/demand-service';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

/** Generate + dispatch demands on demand (same pass the daily cron runs). */
export async function runDemands(): Promise<{ ok: true; result: DemandRun } | { error: string }> {
  try {
    await ensure('booking.manage');
    const result = await runDemandCycle();
    revalidatePath('/demands');
    return { ok: true, result };
  } catch (err) { return toActionError(err); }
}

/** Re-send the still-pending demands without generating new ones. */
export async function resendPendingDemands(): Promise<{ ok: true; dispatched: number } | { error: string }> {
  try {
    await ensure('booking.manage');
    const r = await dispatchPendingDemands(100);
    revalidatePath('/demands');
    return { ok: true, dispatched: r.dispatched };
  } catch (err) { return toActionError(err); }
}

/** Set a buyer's preferred demand/WhatsApp language (module #6): en | hi | kn | ta. */
export async function setBuyerLanguage(leadId: string, lang: string): Promise<{ ok: true } | { error: string }> {
  try {
    await ensure('booking.manage');
    const value = ['en', 'hi', 'kn', 'ta'].includes(lang) ? lang : 'en';
    await prisma.lead.update({ where: { id: leadId }, data: { preferredLang: value } });
    revalidatePath('/demands');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function cancelDemand(id: string): Promise<{ ok: true } | { error: string }> {
  try {
    await ensure('booking.manage');
    await prisma.demandNotice.update({ where: { id }, data: { status: 'CANCELLED' } });
    await writeAudit({ action: 'UPDATE', entityType: 'DemandNotice', entityId: id, summary: 'Demand cancelled' });
    revalidatePath('/demands');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

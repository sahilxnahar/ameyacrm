'use server';
import { revalidatePath } from 'next/cache';
import { processPendingWebhooks, type WorkerResult } from '@/server/services/webhook-worker';
import { ensure, toActionError } from './_helpers';

/** Manually drain the webhook queue (admin). Same logic the cron worker runs. */
export async function runWebhookWorker(): Promise<{ ok: true; result: WorkerResult } | { error: string }> {
  try {
    await ensure('admin.setting.manage');
    const result = await processPendingWebhooks(100);
    revalidatePath('/admin/integration-events');
    return { ok: true, result };
  } catch (err) { return toActionError(err); }
}

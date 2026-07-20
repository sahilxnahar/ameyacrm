'use server';
import { revalidatePath } from 'next/cache';
import { getBriefing } from '@/server/services/briefing-service';
import { isGeminiEnabled } from '@/lib/ai/gemini';
import { ensure, toActionError } from './_helpers';

export async function refreshBriefing(): Promise<{ ok: true } | { error: string }> {
  try {
    await ensure('dashboard.view');
    if (!isGeminiEnabled()) return { error: 'Gemini API key is not configured.' };
    const r = await getBriefing(true);
    if (!r.cached) return { error: 'Could not generate the briefing right now.' };
    revalidatePath('/briefing'); revalidatePath('/dashboard');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

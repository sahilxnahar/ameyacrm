'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { DEFAULT_TERMS, DEFAULT_STAGES, PIPELINE_KEYS } from '@/config/customisation';

export type CustResult = { ok: true } | { error: string };

export async function saveTerms(input: Record<string, string>): Promise<CustResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const clean: Record<string, string> = {};
    for (const k of Object.keys(DEFAULT_TERMS)) {
      const v = (input[k] ?? '').trim();
      if (v && v.length <= 30) clean[k] = v;
    }
    await prisma.setting.upsert({ where: { key: 'terms' }, update: { value: clean }, create: { key: 'terms', value: clean } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Setting', summary: 'Updated terminology' });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function saveStages(input: Record<string, { label: string; probability: number; active: boolean }>): Promise<CustResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const clean: Record<string, { label: string; probability: number; active: boolean }> = {};
    for (const k of PIPELINE_KEYS) {
      const v = input[k];
      if (!v) continue;
      clean[k] = {
        label: String(v.label ?? DEFAULT_STAGES[k].label).slice(0, 30),
        probability: Math.min(100, Math.max(0, Number(v.probability) || 0)),
        active: k === 'NEW' || k === 'WON' || k === 'LOST' ? true : Boolean(v.active),
      };
    }
    await prisma.setting.upsert({ where: { key: 'pipeline.stages' }, update: { value: clean }, create: { key: 'pipeline.stages', value: clean } });
    // The forecast reads its own copy of the odds — keep the two in step.
    const probs = Object.fromEntries(Object.entries(clean).map(([k, v]) => [k, v.probability]));
    await prisma.setting.upsert({ where: { key: 'forecast.probability' }, update: { value: probs }, create: { key: 'forecast.probability', value: probs } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Setting', summary: 'Updated pipeline stages' });
    revalidatePath('/sales'); revalidatePath('/forecast');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function resetCustomisation(what: 'terms' | 'stages'): Promise<CustResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    await prisma.setting.deleteMany({ where: { key: what === 'terms' ? 'terms' : 'pipeline.stages' } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Setting', summary: `Reset ${what}` });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

import 'server-only';
import { cache } from 'react';
import { readSetting } from '@/lib/cache/settings-cache';
import { DEFAULT_TERMS, DEFAULT_STAGES, type Terminology, type StageConfig, type PipelineKey } from '@/config/customisation';

/** The words this company uses, falling back word by word to the defaults. */
export const getTerms = cache(async (): Promise<Terminology> => {
  // Renames every label in the shell, so it is read on every page load and is
  // the same for every user. Cached across requests, invalidated by saveTerms.
  const saved = (await readSetting<Partial<Terminology>>('terms')) ?? {};
  return { ...DEFAULT_TERMS, ...saved };
});

export const getStages = cache(async (): Promise<Record<PipelineKey, StageConfig>> => {
  const saved = (await readSetting<Partial<Record<PipelineKey, Partial<StageConfig>>>>('pipeline.stages')) ?? {};
  const out = {} as Record<PipelineKey, StageConfig>;
  for (const k of Object.keys(DEFAULT_STAGES) as PipelineKey[]) {
    out[k] = { ...DEFAULT_STAGES[k], ...(saved[k] ?? {}) };
  }
  return out;
});

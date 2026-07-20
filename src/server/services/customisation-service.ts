import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';
import { DEFAULT_TERMS, DEFAULT_STAGES, type Terminology, type StageConfig, type PipelineKey } from '@/config/customisation';

/** The words this company uses, falling back word by word to the defaults. */
export const getTerms = cache(async (): Promise<Terminology> => {
  const row = await prisma.setting.findUnique({ where: { key: 'terms' } });
  return { ...DEFAULT_TERMS, ...((row?.value ?? {}) as Partial<Terminology>) };
});

export const getStages = cache(async (): Promise<Record<PipelineKey, StageConfig>> => {
  const row = await prisma.setting.findUnique({ where: { key: 'pipeline.stages' } });
  const saved = (row?.value ?? {}) as Partial<Record<PipelineKey, Partial<StageConfig>>>;
  const out = {} as Record<PipelineKey, StageConfig>;
  for (const k of Object.keys(DEFAULT_STAGES) as PipelineKey[]) {
    out[k] = { ...DEFAULT_STAGES[k], ...(saved[k] ?? {}) };
  }
  return out;
});

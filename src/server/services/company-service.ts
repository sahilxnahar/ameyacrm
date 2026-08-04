import 'server-only';
import { cache } from 'react';
import { readSetting } from '@/lib/cache/settings-cache';
import { COMPANY_DEFAULTS, type CompanyDetails } from '@/config/company';

/** Saved company details, falling back field by field to the defaults. */
export const getCompanyDetails = cache(async (): Promise<CompanyDetails> => {
  // Read through the cross-request cache: this row is the same for everyone and
  // is in the header on every page. `cache()` still wraps it so repeat reads
  // inside one render are free even on a cache miss.
  const saved = (await readSetting<Partial<CompanyDetails>>('company.details')) ?? {};
  return { ...COMPANY_DEFAULTS, ...saved };
});

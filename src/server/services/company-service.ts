import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { COMPANY_DEFAULTS, type CompanyDetails } from '@/config/company';

/** Saved company details, falling back field by field to the defaults. */
export async function getCompanyDetails(): Promise<CompanyDetails> {
  const row = await prisma.setting.findUnique({ where: { key: 'company.details' } });
  const saved = (row?.value ?? {}) as Partial<CompanyDetails>;
  return { ...COMPANY_DEFAULTS, ...saved };
}

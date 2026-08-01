import 'server-only';
import { prisma } from '@/lib/db/prisma';

/**
 * Ameya Tally is multi-company: a real Tally installation holds several
 * companies, each with its own chart of accounts and its own voucher numbering
 * restarting at 1. Everything created inside Ameya itself belongs to the single
 * DEFAULT company; each imported Tally company becomes its own set of books.
 */
export const DEFAULT_TALLY_COMPANY = 'Ameya Heights';

export async function defaultTallyCompanyId(): Promise<string> {
  const existing = await prisma.tallyCompany.findFirst({ where: { isDefault: true }, select: { id: true } });
  if (existing) return existing.id;
  const co = await prisma.tallyCompany.upsert({
    where: { name: DEFAULT_TALLY_COMPANY },
    update: { isDefault: true },
    create: { name: DEFAULT_TALLY_COMPANY, isDefault: true },
    select: { id: true },
  });
  return co.id;
}

/** A caller-supplied company id when valid, otherwise the default books. */
export async function resolveTallyCompanyId(id?: string | null): Promise<string> {
  if (id) {
    const found = await prisma.tallyCompany.findUnique({ where: { id }, select: { id: true } });
    if (found) return found.id;
  }
  return defaultTallyCompanyId();
}

export async function listTallyCompanies(): Promise<{ id: string; name: string; isDefault: boolean }[]> {
  return prisma.tallyCompany.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, isDefault: true },
  }).catch(() => []);
}

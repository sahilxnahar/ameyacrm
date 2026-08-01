import 'server-only';
import { cookies } from 'next/headers';
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
/**
 * Which set of books the user is currently looking at.
 *
 * Held in a cookie rather than passed around as an argument, deliberately: EVERY
 * server action that writes (post a voucher, create a ledger, raise an invoice)
 * must land in the same company the user can see on screen. A per-call argument
 * would eventually be forgotten at one call site and silently post entries into
 * the wrong company's books — the kind of bug you'd only notice at year end.
 * One source of truth means the switch is impossible to get half-applied.
 */
export const TALLY_COMPANY_COOKIE = 'ameya_tally_company';

export async function activeTallyCompanyId(): Promise<string> {
  try {
    const jar = await cookies();
    const id = jar.get(TALLY_COMPANY_COOKIE)?.value;
    if (id) {
      // Verify every time: the company may have been deleted or deactivated
      // since the cookie was set, and a stale id must never widen access.
      const found = await prisma.tallyCompany.findFirst({
        where: { id, isActive: true }, select: { id: true },
      });
      if (found) return found.id;
    }
  } catch {
    // No request scope (background job) — fall through to the default books.
  }
  return defaultTallyCompanyId();
}

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

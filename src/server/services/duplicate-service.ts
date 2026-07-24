import 'server-only';
import { prisma } from '@/lib/db/prisma';

/** Last 10 digits — so "+91 98404 90000", "098404-90000" and "9840490000" all match. */
export function normalizePhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const d = String(p).replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : d || null;
}

export interface DupLead { id: string; reference: string; name: string; email: string | null; phone: string | null; status: string; source: string; owner: string | null; createdAt: string; activities: number; bookings: number }
export interface DupGroup { key: string; kind: 'phone' | 'email'; leads: DupLead[] }

/** Find groups of leads that share a phone number or email address. */
export async function findDuplicateGroups(limit = 60): Promise<DupGroup[]> {
  const leads = await prisma.lead.findMany({
    where: { deletedAt: null }, orderBy: { createdAt: 'asc' }, take: 5000,
    include: { owner: { select: { name: true } }, _count: { select: { activities: true, bookings: true } } },
  });
  const map = (l: (typeof leads)[number]): DupLead => ({
    id: l.id, reference: l.reference, name: l.name, email: l.email, phone: l.phone, status: l.status, source: l.source,
    owner: l.owner?.name ?? null, createdAt: l.createdAt.toISOString(), activities: l._count.activities, bookings: l._count.bookings,
  });

  const byPhone = new Map<string, typeof leads>();
  const byEmail = new Map<string, typeof leads>();
  for (const l of leads) {
    const p = normalizePhone(l.phone);
    if (p) { if (!byPhone.has(p)) byPhone.set(p, []); byPhone.get(p)!.push(l); }
    const e = l.email?.trim().toLowerCase();
    if (e) { if (!byEmail.has(e)) byEmail.set(e, []); byEmail.get(e)!.push(l); }
  }

  const groups: DupGroup[] = [];
  const seen = new Set<string>();
  const add = (kind: 'phone' | 'email', key: string, arr: typeof leads) => {
    if (arr.length < 2) return;
    const sig = arr.map((x) => x.id).sort().join('|');
    if (seen.has(sig)) return;
    seen.add(sig);
    groups.push({ kind, key, leads: arr.map(map) });
  };
  for (const [k, arr] of byPhone) add('phone', k, arr);
  for (const [k, arr] of byEmail) add('email', k, arr);
  return groups.slice(0, limit);
}

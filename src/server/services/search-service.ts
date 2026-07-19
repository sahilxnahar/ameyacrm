import 'server-only';
import { prisma } from '@/lib/db/prisma';

export interface SearchHit { type: string; id: string; title: string; subtitle: string; href: string }

/** Global search across the primary entities. Case-insensitive contains. */
export async function globalSearch(q: string): Promise<SearchHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const like = { contains: term, mode: 'insensitive' as const };

  const [tasks, leads, docs, users, mrs, units, customers, partners] = await Promise.all([
    prisma.task.findMany({ where: { deletedAt: null, OR: [{ title: like }, { reference: like }] }, take: 8, select: { id: true, title: true, reference: true, status: true } }),
    prisma.lead.findMany({ where: { deletedAt: null, OR: [{ name: like }, { reference: like }, { email: like }] }, take: 8, select: { id: true, name: true, reference: true, status: true } }),
    prisma.document.findMany({ where: { deletedAt: null, title: like }, take: 8, select: { id: true, title: true, folder: { select: { name: true } } } }),
    prisma.user.findMany({ where: { deletedAt: null, OR: [{ name: like }, { username: like }, { email: like }] }, take: 8, select: { id: true, name: true, email: true } }),
    prisma.materialRequest.findMany({ where: { OR: [{ title: like }, { reference: like }] }, take: 8, select: { id: true, title: true, reference: true } }),
    prisma.unit.findMany({ where: { code: like }, take: 6, select: { id: true, code: true, project: { select: { name: true } } } }),
    prisma.customer.findMany({ where: { OR: [{ name: like }, { email: like }, { phone: like }] }, take: 6, select: { id: true, name: true } }),
    prisma.channelPartner.findMany({ where: { OR: [{ firmName: like }, { code: like }, { contactName: like }] }, take: 6, select: { id: true, firmName: true, code: true } }),
  ]);

  return [
    ...tasks.map((t): SearchHit => ({ type: 'Task', id: t.id, title: t.title, subtitle: `${t.reference} · ${t.status}`, href: `/tasks/${t.id}` })),
    ...leads.map((l): SearchHit => ({ type: 'Lead', id: l.id, title: l.name, subtitle: `${l.reference} · ${l.status}`, href: `/sales/${l.id}` })),
    ...docs.map((d): SearchHit => ({ type: 'Document', id: d.id, title: d.title, subtitle: d.folder.name, href: `/documents` })),
    ...users.map((u): SearchHit => ({ type: 'User', id: u.id, title: u.name, subtitle: u.email, href: `/admin` })),
    ...mrs.map((m): SearchHit => ({ type: 'Material Request', id: m.id, title: m.title, subtitle: m.reference, href: `/material-requests` })),
    ...units.map((u): SearchHit => ({ type: 'Unit', id: u.id, title: u.code, subtitle: u.project?.name ?? '', href: `/inventory` })),
    ...customers.map((c): SearchHit => ({ type: 'Buyer', id: c.id, title: c.name, subtitle: 'Customer portal', href: `/customers` })),
    ...partners.map((pp): SearchHit => ({ type: 'Channel Partner', id: pp.id, title: pp.firmName, subtitle: pp.code, href: `/partners` })),
  ];
}

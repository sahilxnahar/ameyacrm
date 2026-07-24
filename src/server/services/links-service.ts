import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { entityHref, entityTypeLabel } from '@/lib/links/entities';

export interface RelatedRecord {
  linkId: string;
  type: string;
  typeLabel: string;
  id: string;
  label: string;
  href: string | null;
  kind: string;
}

/** Batch-resolve a set of {type,id} refs to human labels, one query per type. */
async function resolveLabels(refs: Array<{ type: string; id: string }>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const byType = new Map<string, string[]>();
  for (const r of refs) {
    const list = byType.get(r.type) ?? [];
    list.push(r.id);
    byType.set(r.type, list);
  }
  for (const [type, ids] of byType) {
    const uniq = [...new Set(ids)];
    try {
      if (type === 'Lead') {
        const rows = await prisma.lead.findMany({ where: { id: { in: uniq } }, select: { id: true, name: true, reference: true } });
        rows.forEach((r) => out.set(`Lead:${r.id}`, r.name || r.reference));
      } else if (type === 'Task') {
        const rows = await prisma.task.findMany({ where: { id: { in: uniq } }, select: { id: true, title: true } });
        rows.forEach((r) => out.set(`Task:${r.id}`, r.title));
      } else if (type === 'WorkRequest') {
        const rows = await prisma.workRequest.findMany({ where: { id: { in: uniq } }, select: { id: true, title: true, reference: true } });
        rows.forEach((r) => out.set(`WorkRequest:${r.id}`, `${r.reference} · ${r.title}`));
      } else if (type === 'Voucher') {
        const rows = await prisma.voucher.findMany({ where: { id: { in: uniq } }, select: { id: true, number: true, partyName: true } });
        rows.forEach((r) => out.set(`Voucher:${r.id}`, `${r.number} · ${r.partyName}`));
      } else if (type === 'Booking') {
        const rows = await prisma.booking.findMany({ where: { id: { in: uniq } }, select: { id: true, reference: true } });
        rows.forEach((r) => out.set(`Booking:${r.id}`, r.reference));
      } else if (type === 'Unit') {
        const rows = await prisma.unit.findMany({ where: { id: { in: uniq } }, select: { id: true, code: true } });
        rows.forEach((r) => out.set(`Unit:${r.id}`, r.code));
      } else if (type === 'LandParcel') {
        const rows = await prisma.landParcel.findMany({ where: { id: { in: uniq } }, select: { id: true, name: true } });
        rows.forEach((r) => out.set(`LandParcel:${r.id}`, r.name));
      }
    } catch {
      // A resolvable type that fails (e.g. the table is behind) just falls back
      // to a generic label — the panel still renders.
    }
  }
  return out;
}

/**
 * Everything linked to a record, from either direction, resolved to labels and
 * links. Permission-light on purpose: it only reveals that a link exists and
 * where it points — the target page enforces its own access.
 */
export async function getRelated(type: string, id: string): Promise<RelatedRecord[]> {
  const links = await prisma.recordLink.findMany({
    where: { OR: [{ fromType: type, fromId: id }, { toType: type, toId: id }] },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  // The "other end" of each link.
  const others = links.map((l) => {
    const isFrom = l.fromType === type && l.fromId === id;
    return { linkId: l.id, type: isFrom ? l.toType : l.fromType, id: isFrom ? l.toId : l.fromId, kind: l.kind };
  });
  const labels = await resolveLabels(others.map((o) => ({ type: o.type, id: o.id })));
  return others.map((o) => ({
    linkId: o.linkId,
    type: o.type,
    typeLabel: entityTypeLabel(o.type),
    id: o.id,
    label: labels.get(`${o.type}:${o.id}`) ?? `${entityTypeLabel(o.type)} ${o.id.slice(0, 6)}`,
    href: entityHref(o.type, o.id),
    kind: o.kind,
  }));
}

/** Create a link if it does not already exist (either direction). Safe to call repeatedly. */
export async function ensureLink(a: { type: string; id: string }, b: { type: string; id: string }, kind = 'related', createdById?: string | null): Promise<void> {
  if (a.type === b.type && a.id === b.id) return;
  try {
    const existing = await prisma.recordLink.findFirst({
      where: {
        OR: [
          { fromType: a.type, fromId: a.id, toType: b.type, toId: b.id },
          { fromType: b.type, fromId: b.id, toType: a.type, toId: a.id },
        ],
      },
      select: { id: true },
    });
    if (existing) return;
    await prisma.recordLink.create({ data: { fromType: a.type, fromId: a.id, toType: b.type, toId: b.id, kind, createdById: createdById ?? null } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[links] ensureLink failed:', err instanceof Error ? err.message : err);
  }
}

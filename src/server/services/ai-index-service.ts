import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { indexText } from '@/server/services/docqa-service';

/**
 * What the AI is allowed to learn about, and who may then be told.
 *
 * Everything the CRM knows gets indexed. The `permission` on each source
 * travels with every passage, so the same index answers a Super Admin fully
 * and an executive partially — rather than keeping money out of the AI
 * altogether and losing the ability to ask about it at all.
 */
export const AI_SOURCES = [
  { key: 'documents', label: 'Documents & files', permission: null, note: 'Folder locks are also honoured, per person.' },
  { key: 'leads', label: 'Leads & enquiries', permission: 'lead.view', note: null },
  { key: 'bookings', label: 'Bookings & units', permission: 'booking.view', note: null },
  { key: 'invoices', label: 'Invoices raised', permission: 'billing.view', note: null },
  { key: 'vouchers', label: 'Expenses & payments', permission: 'finance.ledger.view', note: 'Only the finance team is ever answered from these.' },
  { key: 'tasks', label: 'Tasks & site updates', permission: 'task.view', note: null },
] as const;

export type AiSourceKey = (typeof AI_SOURCES)[number]['key'];

const inr = (n: number) => `Rs. ${new Intl.NumberFormat('en-IN').format(n)}`;
const day = (d: Date | null) => (d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'no date');

/** Turn a record into the sentences a person would actually ask about. */
async function buildRows(key: AiSourceKey): Promise<Array<{ id: string; title: string; text: string }>> {
  if (key === 'leads') {
    const rows = await prisma.lead.findMany({
      where: { deletedAt: null }, take: 500, orderBy: { createdAt: 'desc' },
      select: { id: true, reference: true, name: true, phone: true, email: true, source: true, status: true,
        requirement: true, budgetMin: true, budgetMax: true, locality: true, country: true, isNri: true,
        project: { select: { name: true } } },
    });
    return rows.map((l) => {
      const where = [l.locality, l.country].filter(Boolean).join(', ');
      return {
        id: l.id, title: `Lead ${l.reference}: ${l.name}`,
        text: [
          `Lead ${l.reference} is ${l.name}.`, l.phone ? `Phone ${l.phone}.` : '', l.email ? `Email ${l.email}.` : '',
          `Source ${l.source}. Status ${l.status}.`,
          l.project?.name ? `Interested in ${l.project.name}.` : '',
          l.budgetMin || l.budgetMax ? `Budget ${inr(Number(l.budgetMin ?? 0))} to ${inr(Number(l.budgetMax ?? 0))}.` : '',
          l.requirement ? `Requirement: ${l.requirement}.` : '',
          where ? `Located in ${where}.` : '',
          l.isNri ? 'This is an NRI enquiry.' : '',
        ].filter(Boolean).join(' '),
      };
    });
  }

  if (key === 'bookings') {
    const rows = await prisma.booking.findMany({
      take: 500, orderBy: { createdAt: 'desc' },
      select: { id: true, reference: true, status: true, paymentStatus: true, agreementValue: true, bookedAt: true,
        lead: { select: { name: true, phone: true } },
        unit: { select: { code: true, typology: true, tower: true, project: { select: { name: true } } } } },
    });
    return rows.map((b) => ({
      id: b.id, title: `Booking ${b.reference}`,
      text: [
        `Booking ${b.reference} for ${b.lead?.name ?? 'a buyer'}.`,
        b.lead?.phone ? `Phone ${b.lead.phone}.` : '',
        b.unit?.code ? `Unit ${b.unit.code}${b.unit.typology ? ` (${b.unit.typology})` : ''}${b.unit.tower ? ` in tower ${b.unit.tower}` : ''}.` : '',
        b.unit?.project?.name ? `Project ${b.unit.project.name}.` : '',
        `Status ${b.status}. Payment status ${b.paymentStatus}. Agreement value ${inr(Number(b.agreementValue ?? 0))}. Booked on ${day(b.bookedAt)}.`,
      ].filter(Boolean).join(' '),
    }));
  }

  if (key === 'invoices') {
    const rows = await prisma.invoice.findMany({
      take: 500, orderBy: { issueDate: 'desc' },
      select: { id: true, number: true, clientName: true, status: true, total: true, amountPaid: true,
        issueDate: true, dueDate: true, notes: true, project: { select: { name: true } } },
    });
    return rows.map((i) => ({
      id: i.id, title: `Invoice ${i.number}`,
      text: [
        `Invoice ${i.number} to ${i.clientName} for ${inr(Number(i.total))}.`,
        `Status ${i.status}. Received so far ${inr(Number(i.amountPaid))}.`,
        i.project?.name ? `Project ${i.project.name}.` : '',
        `Issued ${day(i.issueDate)}${i.dueDate ? `, due ${day(i.dueDate)}` : ''}.`,
        i.notes ?? '',
      ].filter(Boolean).join(' '),
    }));
  }

  if (key === 'vouchers') {
    const rows = await prisma.voucher.findMany({
      take: 1000, orderBy: { voucherDate: 'desc' },
      select: { id: true, number: true, kind: true, partyName: true, amount: true, mode: true,
        utr: true, paidOn: true, voucherDate: true, narration: true, status: true },
    });
    return rows.map((v) => ({
      id: v.id, title: `${v.number} — ${v.partyName}`,
      text: [
        `${v.kind.replace(/_/g, ' ').toLowerCase()} ${v.number}: ${inr(Number(v.amount))} ${v.kind.includes('PAID') ? 'paid to' : 'received from'} ${v.partyName}.`,
        `Dated ${day(v.paidOn ?? v.voucherDate)}. Mode ${v.mode}.`,
        v.utr ? `UTR ${v.utr}.` : 'No UTR recorded.',
        v.status === 'CANCELLED' ? 'This voucher is cancelled.' : '',
        v.narration ?? '',
      ].filter(Boolean).join(' '),
    }));
  }

  if (key === 'tasks') {
    const rows = await prisma.task.findMany({
      where: { deletedAt: null }, take: 500, orderBy: { createdAt: 'desc' },
      select: { id: true, reference: true, title: true, description: true, status: true, priority: true,
        dueDate: true, completedAt: true, project: { select: { name: true } } },
    });
    return rows.map((t) => ({
      id: t.id, title: `Task ${t.reference}: ${t.title}`,
      text: [
        `Task ${t.reference}: "${t.title}".`,
        `Status ${t.status}, priority ${t.priority}.`,
        t.project?.name ? `Project ${t.project.name}.` : '',
        t.dueDate ? `Due ${day(t.dueDate)}.` : '',
        t.completedAt ? `Completed ${day(t.completedAt)}.` : '',
        t.description ?? '',
      ].filter(Boolean).join(' '),
    }));
  }

  return [];
}

export interface IndexReport { source: string; label: string; indexed: number; skipped: number; error: string | null }

/**
 * Re-index one source. Documents are handled by the upload pipeline, so this
 * covers the structured records the AI could not previously see at all.
 */
export async function reindexSource(key: AiSourceKey): Promise<IndexReport> {
  const meta = AI_SOURCES.find((s) => s.key === key)!;
  const report: IndexReport = { source: key, label: meta.label, indexed: 0, skipped: 0, error: null };
  if (key === 'documents') {
    report.skipped = await prisma.fileObject.count({ where: { ocrText: null } });
    report.indexed = await prisma.docChunk.count({ where: { entityType: null } });
    return report;
  }
  try {
    const rows = await buildRows(key);
    const entityType = { leads: 'Lead', bookings: 'Booking', invoices: 'Invoice', vouchers: 'Voucher', tasks: 'Task' }[key] ?? key;
    for (const r of rows) {
      if (!r.text || r.text.length < 12) { report.skipped++; continue; }
      const n = await indexText({
        title: r.title, text: r.text, source: meta.label,
        requiredPermission: meta.permission, entityType, entityId: r.id,
      });
      if (n > 0) report.indexed++; else report.skipped++;
    }
  } catch (e) {
    report.error = e instanceof Error ? e.message : 'Indexing failed';
  }
  return report;
}

/** What the AI currently knows, counted from the index itself. */
export async function indexCoverage(): Promise<Array<{ key: string; label: string; permission: string | null; note: string | null; passages: number; records: number }>> {
  const out = [];
  for (const s of AI_SOURCES) {
    const entityType = { documents: null, leads: 'Lead', bookings: 'Booking', invoices: 'Invoice', vouchers: 'Voucher', tasks: 'Task' }[s.key] ?? null;
    const [passages, records] = await Promise.all([
      prisma.docChunk.count({ where: entityType ? { entityType } : { entityType: null } }),
      entityType
        ? prisma.docChunk.findMany({ where: { entityType }, select: { entityId: true }, distinct: ['entityId'] }).then((r) => r.length)
        : prisma.fileObject.count(),
    ]);
    out.push({ key: s.key, label: s.label, permission: s.permission, note: s.note, passages, records });
  }
  return out;
}

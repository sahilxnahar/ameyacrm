import 'server-only';
import { prisma } from '@/lib/db/prisma';

/**
 * The shared inbox. One place for the whole team to see conversations that came
 * in over email or WhatsApp and reply to them — instead of each person watching
 * their own Gmail and phone.
 *
 * Nothing new is ingested here: inbound email already lands in MailThreadMessage
 * (via /api/ingest/email) and inbound WhatsApp in WhatsappMessage (via the
 * WhatsApp webhook). This service just groups those into conversations and the
 * reply action (src/server/actions/inbox.ts) sends the answer back out and
 * records it in the same thread, so the next person sees the full history.
 */

export type InboxChannel = 'EMAIL' | 'WHATSAPP';

export interface ThreadSummary {
  channel: InboxChannel;
  key: string;            // threadKey for email, phone for WhatsApp
  title: string;          // the person/company, in plain words
  subtitle: string;       // their address or number
  lastSnippet: string;
  lastAt: string;         // ISO
  count: number;
  unhandled: number;      // inbound messages with no reply yet (best-effort)
  partyLink: string | null;
  replyTo: string;        // address or number to reply to
}

export interface ThreadMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  from: string;
  subject: string | null;
  body: string;
  at: string;             // ISO
}

const EMAIL_SCAN = 400;
const WA_SCAN = 400;

export async function listThreads(): Promise<ThreadSummary[]> {
  const [emails, waMsgs] = await Promise.all([
    prisma.mailThreadMessage.findMany({
      orderBy: { sentAt: 'desc' },
      take: EMAIL_SCAN,
      select: {
        threadKey: true, direction: true, subject: true, snippet: true, bodyText: true,
        sentAt: true, fromAddress: true, toAddresses: true,
        leadId: true, customerId: true, vendorId: true,
      },
    }).catch(() => []),
    prisma.whatsappMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: WA_SCAN,
      select: { phone: true, direction: true, body: true, outcome: true, kind: true, handled: true, createdAt: true, userId: true },
    }).catch(() => []),
  ]);

  // ── Email threads ──────────────────────────────────────────────────────────
  const emailThreads = new Map<string, ThreadSummary & { _leadId?: string | null; _customerId?: string | null; _vendorId?: string | null }>();
  for (const m of emails) {
    let t = emailThreads.get(m.threadKey);
    if (!t) {
      const counterparty = m.direction === 'OUTBOUND' ? (m.toAddresses[0] ?? '') : m.fromAddress;
      t = {
        channel: 'EMAIL', key: m.threadKey, title: counterparty || 'Unknown',
        subtitle: counterparty, lastSnippet: (m.snippet || m.bodyText || '').slice(0, 140),
        lastAt: m.sentAt.toISOString(), count: 0, unhandled: 0, partyLink: null, replyTo: counterparty,
        _leadId: m.leadId, _customerId: m.customerId, _vendorId: m.vendorId,
      };
      emailThreads.set(m.threadKey, t);
    }
    t.count++;
    if (m.direction === 'INBOUND') t.unhandled++;
    else t.unhandled = Math.max(0, t.unhandled - 1);
    if (!t._leadId && m.leadId) t._leadId = m.leadId;
    if (!t._customerId && m.customerId) t._customerId = m.customerId;
    if (!t._vendorId && m.vendorId) t._vendorId = m.vendorId;
  }

  // Resolve party names + deep links in a couple of batched queries.
  const leadIds = [...new Set([...emailThreads.values()].map((t) => t._leadId).filter(Boolean) as string[])];
  const custIds = [...new Set([...emailThreads.values()].map((t) => t._customerId).filter(Boolean) as string[])];
  const vendIds = [...new Set([...emailThreads.values()].map((t) => t._vendorId).filter(Boolean) as string[])];
  const [leads, customers, vendors] = await Promise.all([
    leadIds.length ? prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true } }) : [],
    custIds.length ? prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true } }) : [],
    vendIds.length ? prisma.vendor.findMany({ where: { id: { in: vendIds } }, select: { id: true, name: true } }) : [],
  ]);
  const leadName = new Map(leads.map((l) => [l.id, l.name]));
  const custName = new Map(customers.map((c) => [c.id, c.name]));
  const vendName = new Map(vendors.map((v) => [v.id, v.name]));
  for (const t of emailThreads.values()) {
    if (t._leadId && leadName.has(t._leadId)) { t.title = leadName.get(t._leadId)!; t.partyLink = `/sales?lead=${t._leadId}`; }
    else if (t._customerId && custName.has(t._customerId)) { t.title = custName.get(t._customerId)!; t.partyLink = `/customers`; }
    else if (t._vendorId && vendName.has(t._vendorId)) { t.title = vendName.get(t._vendorId)!; t.partyLink = `/billing`; }
    delete t._leadId; delete t._customerId; delete t._vendorId;
  }

  // ── WhatsApp conversations (grouped by phone) ───────────────────────────────
  const waThreads = new Map<string, ThreadSummary>();
  const waUserIds = new Set<string>();
  for (const m of waMsgs) {
    let t = waThreads.get(m.phone);
    const text = m.body || m.outcome || `(${m.kind})`;
    if (!t) {
      t = {
        channel: 'WHATSAPP', key: m.phone, title: m.phone, subtitle: m.phone,
        lastSnippet: text.slice(0, 140), lastAt: m.createdAt.toISOString(),
        count: 0, unhandled: 0, partyLink: null, replyTo: m.phone,
      };
      waThreads.set(m.phone, t);
    }
    t.count++;
    if (m.direction === 'INBOUND' && !m.handled) t.unhandled++;
    if (m.userId) waUserIds.add(m.userId);
  }
  // Name a conversation after the staff member whose number it is, when known.
  if (waUserIds.size) {
    const users = await prisma.user.findMany({ where: { id: { in: [...waUserIds] } }, select: { id: true, name: true, whatsappNumber: true, phone: true } });
    for (const u of users) {
      const last10 = (n: string | null) => (n ?? '').replace(/\D/g, '').slice(-10);
      for (const t of waThreads.values()) {
        if (t.title !== t.key) continue;
        const p10 = t.key.replace(/\D/g, '').slice(-10);
        if (p10 && (last10(u.whatsappNumber) === p10 || last10(u.phone) === p10)) t.title = u.name;
      }
    }
  }

  return [...emailThreads.values(), ...waThreads.values()]
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

export async function getThread(channel: InboxChannel, key: string): Promise<ThreadMessage[]> {
  if (channel === 'EMAIL') {
    const rows = await prisma.mailThreadMessage.findMany({
      where: { threadKey: key },
      orderBy: { sentAt: 'asc' },
      take: 200,
      select: { id: true, direction: true, fromAddress: true, subject: true, bodyText: true, snippet: true, sentAt: true },
    });
    return rows.map((r) => ({
      id: r.id, direction: r.direction, from: r.fromAddress,
      subject: r.subject, body: r.bodyText || r.snippet || '', at: r.sentAt.toISOString(),
    }));
  }
  const rows = await prisma.whatsappMessage.findMany({
    where: { phone: key },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: { id: true, direction: true, phone: true, body: true, outcome: true, kind: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id, direction: r.direction, from: r.direction === 'OUTBOUND' ? 'You' : r.phone,
    subject: null, body: r.body || r.outcome || `(${r.kind})`, at: r.createdAt.toISOString(),
  }));
}

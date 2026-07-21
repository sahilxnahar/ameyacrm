import 'server-only';
import { prisma } from '@/lib/db/prisma';

/** Normalise a subject so "Re: Re: Fwd: X" threads with "X". */
export function threadKeyFor(subject: string | null | undefined, counterparty: string): string {
  let base = (subject ?? '').trim();
  for (let i = 0; i < 4; i++) base = base.replace(/^\s*(re|fwd|fw)\s*:\s*/i, '');
  return `${counterparty.toLowerCase()}|${base.toLowerCase().slice(0, 120) || 'no-subject'}`;
}

export function extractAddress(raw: string): string {
  const m = raw.match(/<([^>]+)>/);
  return (m?.[1] ?? raw).trim().toLowerCase();
}

/** Who does this address belong to? Leads first, then buyers. */
export interface PartyMatch {
  leadId: string | null;
  customerId: string | null;
  vendorId: string | null;
  vendorName: string | null;
}

/**
 * Work out who an email is with.
 *
 * Vendors are matched on the exact address first, then on the domain — a quote
 * from accounts@ and a delivery note from despatch@ at the same supplier are
 * the same relationship, and only matching exact addresses meant most vendor
 * mail was thrown away.
 */
export async function matchParty(address: string): Promise<PartyMatch> {
  const email = address.toLowerCase().trim();
  const none: PartyMatch = { leadId: null, customerId: null, vendorId: null, vendorName: null };
  if (!email) return none;

  const lead = await prisma.lead.findFirst({ where: { email, deletedAt: null }, select: { id: true }, orderBy: { updatedAt: 'desc' } });
  if (lead) return { ...none, leadId: lead.id };

  const customer = await prisma.customer.findFirst({ where: { email }, select: { id: true } });
  if (customer) return { ...none, customerId: customer.id };

  const vendor = await prisma.vendor.findFirst({ where: { email, isActive: true }, select: { id: true, name: true } });
  if (vendor) return { ...none, vendorId: vendor.id, vendorName: vendor.name };

  // Fall back to the domain, ignoring the free mail providers where a domain
  // says nothing about who the sender is.
  const domain = email.split('@')[1] ?? '';
  const GENERIC = new Set(['gmail.com', 'yahoo.com', 'yahoo.co.in', 'outlook.com', 'hotmail.com', 'rediffmail.com', 'icloud.com', 'live.com', 'proton.me']);
  if (domain && !GENERIC.has(domain)) {
    const byDomain = await prisma.vendor.findFirst({
      where: { email: { endsWith: `@${domain}` }, isActive: true },
      select: { id: true, name: true },
    });
    if (byDomain) return { ...none, vendorId: byDomain.id, vendorName: byDomain.name };
  }
  return none;
}

/** Strip quoted history so the thread shows what was actually written. */
export function stripQuoted(body: string): string {
  const cut = body.split(/\n\s*(?:On .{5,80} wrote:|-{2,}\s*Original Message|_{5,}|From:\s)/i)[0] ?? body;
  return cut.replace(/\n{3,}/g, '\n\n').trim();
}

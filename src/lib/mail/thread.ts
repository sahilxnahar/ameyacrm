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
  return (m ? m[1] : raw).trim().toLowerCase();
}

/** Who does this address belong to? Leads first, then buyers. */
export async function matchParty(address: string): Promise<{ leadId: string | null; customerId: string | null }> {
  const email = address.toLowerCase();
  const lead = await prisma.lead.findFirst({ where: { email, deletedAt: null }, select: { id: true }, orderBy: { updatedAt: 'desc' } });
  if (lead) return { leadId: lead.id, customerId: null };
  const customer = await prisma.customer.findFirst({ where: { email }, select: { id: true } });
  if (customer) return { leadId: null, customerId: customer.id };
  return { leadId: null, customerId: null };
}

/** Strip quoted history so the thread shows what was actually written. */
export function stripQuoted(body: string): string {
  const cut = body.split(/\n\s*(?:On .{5,80} wrote:|-{2,}\s*Original Message|_{5,}|From:\s)/i)[0];
  return cut.replace(/\n{3,}/g, '\n\n').trim();
}

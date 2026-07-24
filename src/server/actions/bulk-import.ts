'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { nextReference } from '@/lib/utils/reference';
import { findDuplicateLead } from '@/lib/leads/dedup';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { toNumber, toDate } from '@/lib/import/parse';
import type { UnitStatus, LeadSource, LeadStatus, PaymentStatus } from '@prisma/client';

/**
 * Work out who was paid from a line like "Paid to SV for Plan sanction".
 * Expense sheets rarely have a clean party column, and guessing well beats
 * making somebody retype 200 rows.
 */
function partyFrom(text: string): string {
  const t = text.trim();
  const m = t.match(/paid to ([A-Za-z][A-Za-z .&]*?)(?:\s+for\b|\s*[-–,.]|$)/i);
  if (m?.[1]) return m[1].trim().slice(0, 60);
  const known = ['BBMP', 'BESCOM', 'BWSSB', 'KPTCL', 'Google', 'Geofrontier'];
  for (const k of known) if (new RegExp(k, 'i').test(t)) return k;
  return (t.split(/[-–]/)[0] ?? '').trim().slice(0, 60) || 'Unrecorded';
}

export interface RowResult { row: number; ok: boolean; message: string }
export type ImportResult =
  | { ok: true; created: number; updated: number; skipped: number; failed: number; results: RowResult[] }
  | { error: string };

type Rows = Array<Record<string, string>>;

const UNIT_STATUS: UnitStatus[] = ['AVAILABLE', 'HELD', 'BOOKED', 'SOLD', 'BLOCKED'];
const LEAD_STATUS: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'WON', 'LOST'];
const LEAD_SOURCE: LeadSource[] = ['WEBSITE', 'REFERRAL', 'WALK_IN', 'CAMPAIGN', 'PORTAL', 'NRI_DESK', 'BROKER', 'OTHER'];

const pick = <T extends string>(v: string, allowed: T[], fallback: T): T => {
  const up = (v || '').trim().toUpperCase().replace(/[\s-]/g, '_');
  return (allowed as string[]).includes(up) ? (up as T) : fallback;
};

/**
 * Import a batch. `dryRun` validates and reports without writing, which is what
 * the preview step uses — people should see what will happen before it happens.
 */
export async function runImport(
  kind: 'units' | 'bookings' | 'milestones' | 'customers' | 'leads' | 'expenses',
  projectId: string | null,
  rows: Rows,
  dryRun: boolean,
): Promise<ImportResult> {
  try {
    // Expenses land in the cash book, so importing them needs the ledger
    // permission on top of the usual import rights.
    const ctx = await ensure(kind === 'expenses' ? 'finance.ledger.manage' : 'admin.setting.manage');
    if (!rows.length) return { error: 'Nothing to import — paste some rows first.' };
    if (rows.length > 2000) return { error: 'Please import at most 2000 rows at a time.' };

    const results: RowResult[] = [];
    let created = 0, updated = 0, skipped = 0, failed = 0;

    const users = await prisma.user.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });
    const userByName = new Map(users.map((u) => [u.name.trim().toLowerCase(), u.id]));

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const line = i + 2; // +1 for zero index, +1 for the header row
      if (!r) continue; // cannot happen while iterating by index, but proves it to the compiler
      try {
        if (kind === 'units') {
          if (!projectId) { results.push({ row: line, ok: false, message: 'Choose a project first.' }); failed++; continue; }
          const code = (r.code || '').trim();
          if (!code) { results.push({ row: line, ok: false, message: 'Unit code is blank.' }); failed++; continue; }
          const data = {
            projectId, code,
            tower: r.tower || null,
            floor: toNumber(r.floor ?? '') ?? 0,
            typology: r.typology || '—',
            carpetAreaSqft: toNumber(r.carpetAreaSqft ?? '') ?? 0,
            price: toNumber(r.price ?? '') ?? 0,
            facing: r.facing || null,
            status: pick(r.status ?? '', UNIT_STATUS, 'AVAILABLE'),
          };
          const existing = await prisma.unit.findFirst({ where: { projectId, code }, select: { id: true } });
          if (!dryRun) {
            if (existing) { await prisma.unit.update({ where: { id: existing.id }, data }); }
            else { await prisma.unit.create({ data }); }
          }
          existing ? updated++ : created++;
          results.push({ row: line, ok: true, message: existing ? `${code} updated` : `${code} created` });
        }

        else if (kind === 'customers') {
          const name = (r.name || '').trim();
          if (!name) { results.push({ row: line, ok: false, message: 'Name is blank.' }); failed++; continue; }
          const email = (r.email || '').trim().toLowerCase() || null;
          const existing = email ? await prisma.customer.findFirst({ where: { email }, select: { id: true } }) : null;
          let bookingId: string | null = null;
          if (r.unitCode) {
            const unit = await prisma.unit.findFirst({ where: { code: r.unitCode.trim() }, select: { id: true } });
            if (unit) {
              const bk = await prisma.booking.findFirst({ where: { unitId: unit.id }, select: { id: true } });
              bookingId = bk?.id ?? null;
            }
          }
          if (!dryRun) {
            if (existing) await prisma.customer.update({ where: { id: existing.id }, data: { name, phone: r.phone || null, ...(bookingId ? { bookingId } : {}) } });
            else await prisma.customer.create({ data: { name, email, phone: r.phone || null, projectId, bookingId, portalToken: cryptoToken() } });
          }
          existing ? updated++ : created++;
          results.push({ row: line, ok: true, message: existing ? `${name} updated` : `${name} created` });
        }

        else if (kind === 'bookings') {
          const code = (r.unitCode || '').trim();
          const buyer = (r.buyerName || '').trim();
          if (!code || !buyer) { results.push({ row: line, ok: false, message: 'Unit code and buyer name are both needed.' }); failed++; continue; }
          const unit = await prisma.unit.findFirst({ where: { code, ...(projectId ? { projectId } : {}) }, select: { id: true } });
          if (!unit) { results.push({ row: line, ok: false, message: `No unit called "${code}" — import units first.` }); failed++; continue; }

          const exists = await prisma.booking.findFirst({ where: { unitId: unit.id }, select: { id: true, reference: true } });
          if (exists) { skipped++; results.push({ row: line, ok: true, message: `${code} already booked (${exists.reference}) — left alone` }); continue; }

          if (!dryRun) {
            const dupe = await findDuplicateLead(r.buyerPhone || null, null);
            let leadId = dupe?.id ?? null;
            if (!leadId) {
              const lead = await prisma.lead.create({
                data: { reference: await nextReference('LEAD'), name: buyer, phone: r.buyerPhone || null, status: 'WON', source: 'OTHER', projectId },
              });
              leadId = lead.id;
            }
            await prisma.booking.create({
              data: {
                reference: await nextReference('BKG'),
                unitId: unit.id, leadId,
                salesRepId: userByName.get((r.salesRep || '').trim().toLowerCase()) ?? null,
                agreementValue: toNumber(r.agreementValue ?? '') ?? 0,
                bookedAt: toDate(r.bookedAt ?? '') ?? new Date(),
                status: 'CONFIRMED',
              },
            });
            await prisma.unit.update({ where: { id: unit.id }, data: { status: 'BOOKED' } });
          }
          created++;
          results.push({ row: line, ok: true, message: `${code} → ${buyer}` });
        }

        else if (kind === 'milestones') {
          const code = (r.unitCode || '').trim();
          const label = (r.label || '').trim();
          const amount = toNumber(r.amount ?? '');
          if (!code || !label || amount === null) { results.push({ row: line, ok: false, message: 'Unit, milestone and amount are all needed.' }); failed++; continue; }
          const unit = await prisma.unit.findFirst({ where: { code }, select: { id: true } });
          const booking = unit ? await prisma.booking.findFirst({ where: { unitId: unit.id }, select: { id: true } }) : null;
          if (!booking) { results.push({ row: line, ok: false, message: `No booking for "${code}" — import bookings first.` }); failed++; continue; }

          const dupe = await prisma.paymentMilestone.findFirst({ where: { bookingId: booking.id, label }, select: { id: true } });
          if (dupe) { skipped++; results.push({ row: line, ok: true, message: `${code} · ${label} already there` }); continue; }

          const paid = /paid|received|yes|done/i.test(r.status ?? '');
          if (!dryRun) {
            await prisma.paymentMilestone.create({
              data: {
                bookingId: booking.id, label, amount,
                dueDate: toDate(r.dueDate ?? ''),
                status: (paid ? 'PAID' : 'PENDING') as PaymentStatus,
                paidAt: paid ? (toDate(r.dueDate ?? '') ?? new Date()) : null,
              },
            });
          }
          created++;
          results.push({ row: line, ok: true, message: `${code} · ${label} · ${amount.toLocaleString('en-IN')}` });
        }

        else if (kind === 'expenses') {
          const particulars = (r.particulars || '').trim();
          const amount = toNumber(r.amount ?? '');
          if (!particulars || amount === null || amount <= 0) {
            results.push({ row: line, ok: false, message: 'Needs a description and an amount above zero.' });
            failed++; continue;
          }

          const party = (r.partyName || '').trim() || partyFrom(particulars);
          const when = toDate(r.date ?? '');

          // Same description, same amount, same day — almost certainly a re-paste.
          const dupe = await prisma.voucher.findFirst({
            where: { kind: 'CASH_PAID', amount, narration: particulars },
            select: { number: true },
          });
          if (dupe) { skipped++; results.push({ row: line, ok: true, message: `Already recorded as ${dupe.number}` }); continue; }

          if (!dryRun) {
            const last = await prisma.voucher.findFirst({
              where: { number: { startsWith: 'CP-' } }, orderBy: { number: 'desc' }, select: { number: true },
            });
            const seq = last ? Number(last.number.split('-')[1] ?? '1000') : 1000;
            const notes = [r.notes, r.poc ? `Handled by ${r.poc}` : ''].filter(Boolean).join(' · ');
            await prisma.voucher.create({
              data: {
                number: `CP-${(Number.isFinite(seq) ? seq : 1000) + 1}`,
                kind: 'CASH_PAID',
                voucherDate: when ?? new Date(),
                partyName: party,
                projectId: projectId || null,
                amount,
                mode: /cash/i.test(particulars) ? 'CASH' : 'BANK_TRANSFER',
                reference: r.reference || null,
                narration: [particulars, notes].filter(Boolean).join(' — ').slice(0, 500),
              },
            });
          }
          created++;
          results.push({
            row: line, ok: true,
            message: `${party} · ${amount.toLocaleString('en-IN')}${when ? '' : ' (no date given — dated today)'}`,
          });
        }

        else if (kind === 'leads') {
          const name = (r.name || '').trim();
          if (!name) { results.push({ row: line, ok: false, message: 'Name is blank.' }); failed++; continue; }
          const phone = (r.phone || '').trim() || null;
          const email = (r.email || '').trim().toLowerCase() || null;
          const dupe = await findDuplicateLead(phone, email);
          if (dupe) { skipped++; results.push({ row: line, ok: true, message: `${name} already exists — left alone` }); continue; }
          if (!dryRun) {
            await prisma.lead.create({
              data: {
                reference: await nextReference('LEAD'), name, phone, email, projectId,
                source: pick(r.source ?? '', LEAD_SOURCE, 'OTHER'),
                status: pick(r.status ?? '', LEAD_STATUS, 'NEW'),
                locality: r.locality || null,
                budgetMax: toNumber(r.budgetMax ?? ''),
                requirement: r.requirement || null,
                ownerId: userByName.get((r.owner || '').trim().toLowerCase()) ?? null,
              },
            });
          }
          created++;
          results.push({ row: line, ok: true, message: `${name} created` });
        }
      } catch (err) {
        failed++;
        results.push({ row: line, ok: false, message: err instanceof Error ? err.message.slice(0, 160) : 'failed' });
      }
    }

    if (!dryRun) {
      await writeAudit({
        actorId: ctx.user.id, action: 'CREATE', entityType: 'Setting',
        summary: `Imported ${kind}: ${created} created, ${updated} updated, ${skipped} skipped, ${failed} failed`,
      });
      revalidatePath('/inventory'); revalidatePath('/sales'); revalidatePath('/billing'); revalidatePath('/customers');
    }

    return { ok: true, created, updated, skipped, failed, results };
  } catch (err) { return toActionError(err); }
}

function cryptoToken() {
  return Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
}

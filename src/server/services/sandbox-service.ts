import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';
/**
 * Only the writes seeding performs, typed structurally.
 *
 * Prisma's client and its transaction client have different generated model
 * types and do not unify, so a union of the two is unusable as a parameter.
 * Naming just the handful of calls used here satisfies both.
 */
type SeedClient = {
  sandboxLead: { createMany: (a: { data: unknown[] }) => Promise<unknown> };
  sandboxUnit: { createMany: (a: { data: unknown[] }) => Promise<unknown> };
  sandboxTask: { createMany: (a: { data: unknown[] }) => Promise<unknown> };
  sandboxLedgerEntry: { createMany: (a: { data: unknown[] }) => Promise<unknown> };
  sandboxNote: { create: (a: { data: unknown }) => Promise<unknown> };
};

/**
 * The guest sandbox: a private, disposable copy of the CRM's data shapes.
 *
 * Guests can create, edit and delete freely in here. Nothing they do can reach
 * real company data, because none of these queries touch the real tables.
 */

/** How long a guest's playground lives before it is wiped and re-seeded. */
export const SANDBOX_TTL_HOURS = 24;

export const getOrCreateSandbox = cache(async (userId: string): Promise<{ id: string; freshlySeeded: boolean }> => {
  const now = new Date();
  const existing = await prisma.guestSandbox.findUnique({
    where: { userId },
    select: { id: true, expiresAt: true, seeded: true },
  });

  if (existing && existing.expiresAt > now && existing.seeded) {
    return { id: existing.id, freshlySeeded: false };
  }

  // Expired (or half-built): wipe it back to a clean demo rather than leaving a
  // guest staring at whatever the last person left behind.
  if (existing) {
    await prisma.guestSandbox.delete({ where: { id: existing.id } }).catch(() => undefined);
  }

  // Create, seed and mark seeded as ONE transaction.
  //
  // Previously these were three separate statements. If seeding failed partway
  // — or the `seeded` flag never got written — the sandbox existed but was
  // marked unseeded, so the branch above missed and EVERY subsequent page load
  // deleted it and rebuilt ~46 rows from scratch. That is the "demo is slow"
  // report, and it also silently threw away anything the guest had just added.
  // A transaction makes a half-built sandbox impossible: either it exists fully
  // seeded, or it does not exist.
  const id = await prisma.$transaction(async (tx) => {
    const sandbox = await tx.guestSandbox.create({
      data: { userId, expiresAt: new Date(now.getTime() + SANDBOX_TTL_HOURS * 3600_000) },
      select: { id: true },
    });
    await seedSandbox(sandbox.id, tx as unknown as SeedClient);
    await tx.guestSandbox.update({ where: { id: sandbox.id }, data: { seeded: true } });
    return sandbox.id;
  }, { timeout: 20_000 });

  return { id, freshlySeeded: true };
});

/**
 * Fill a new sandbox with believable demo data.
 *
 * Deliberately fictional — a made-up project, invented buyers, round numbers.
 * A guest must never be shown anything that looks like it might be real, both
 * because it would be misleading and because a demo account is exactly where a
 * plausible-looking figure would end up quoted back at somebody.
 */
export async function seedSandbox(sandboxId: string, tx: SeedClient = prisma as unknown as SeedClient): Promise<void> {
  const day = (n: number) => new Date(Date.now() + n * 86400_000);

  await tx.sandboxLead.createMany({
    data: [
      { sandboxId, name: 'Rohan Mehta', phone: '+91 90000 00001', email: 'rohan.demo@example.com', source: 'Website', status: 'QUALIFIED', budget: 9500000, note: 'Wants a 3BHK with a park view. Site visit done.' },
      { sandboxId, name: 'Priya Nair', phone: '+91 90000 00002', email: 'priya.demo@example.com', source: 'Walk-in', status: 'SITE_VISIT', budget: 7200000, note: 'Comparing us with two other projects nearby.' },
      { sandboxId, name: 'Arjun Desai', phone: '+91 90000 00003', email: 'arjun.demo@example.com', source: 'Referral', status: 'NEW', budget: 12000000, note: 'Referred by an existing buyer.' },
      { sandboxId, name: 'Sneha Kulkarni', phone: '+91 90000 00004', email: 'sneha.demo@example.com', source: 'Portal', status: 'NEGOTIATION', budget: 8800000, note: 'Asking for a 2% discount on the corner unit.' },
      { sandboxId, name: 'Imran Shaikh', phone: '+91 90000 00005', email: 'imran.demo@example.com', source: 'Website', status: 'BOOKED', budget: 10500000, note: 'Booked A-1204. Agreement pending.' },
    ],
  });

  const units: Array<{ tower: string; number: string; typology: string; areaSqft: number; price: number; status: string }> = [];
  for (const tower of ['A', 'B']) {
    for (let floor = 10; floor <= 14; floor++) {
      for (const pos of ['01', '02', '03']) {
        const typology = pos === '02' ? '2 BHK' : '3 BHK';
        const areaSqft = typology === '2 BHK' ? 980 : 1340;
        units.push({
          tower: `Tower ${tower}`,
          number: `${tower}-${floor}${pos}`,
          typology,
          areaSqft,
          price: areaSqft * 7200,
          status: floor === 12 && pos === '04' ? 'BOOKED' : floor % 3 === 0 ? 'HELD' : 'AVAILABLE',
        });
      }
    }
  }
  await tx.sandboxUnit.createMany({ data: units.map((u) => ({ sandboxId, ...u })) });

  await tx.sandboxTask.createMany({
    data: [
      { sandboxId, title: 'Call Rohan Mehta about the 3BHK', dueDate: day(0) },
      { sandboxId, title: 'Send the price list to Priya Nair', dueDate: day(1) },
      { sandboxId, title: 'Follow up on Sneha’s discount request', dueDate: day(2) },
      { sandboxId, title: 'Collect the booking amount for A-1204', dueDate: day(-1) },
      { sandboxId, title: 'Site walkthrough with the contractor', dueDate: day(3), done: true },
    ],
  });

  await tx.sandboxLedgerEntry.createMany({
    data: [
      { sandboxId, date: day(-20), narration: 'Booking amount — Imran Shaikh (A-1204)', debitAcc: 'Bank', creditAcc: 'Advance from Customers', amount: 500000 },
      { sandboxId, date: day(-14), narration: 'Cement purchase — 400 bags', debitAcc: 'Material Purchase', creditAcc: 'Sundry Creditors', amount: 140000 },
      { sandboxId, date: day(-10), narration: 'Contractor running bill — Tower A', debitAcc: 'Construction WIP', creditAcc: 'Sundry Creditors', amount: 850000 },
      { sandboxId, date: day(-5), narration: 'Marketing — portal listings', debitAcc: 'Marketing Expense', creditAcc: 'Bank', amount: 65000 },
      { sandboxId, date: day(-2), narration: 'Instalment received — Imran Shaikh', debitAcc: 'Bank', creditAcc: 'Advance from Customers', amount: 1200000 },
    ],
  });

  await tx.sandboxNote.create({
    data: { sandboxId, body: 'This is your own private demo workspace. Everything here is made up, and nothing you do affects real data. It resets automatically after a day.' },
  });
}

export interface SandboxData {
  leads: Array<{ id: string; name: string; phone: string | null; source: string; status: string; budget: number | null; note: string | null }>;
  units: Array<{ id: string; tower: string; number: string; typology: string; areaSqft: number; price: number; status: string }>;
  tasks: Array<{ id: string; title: string; done: boolean; dueDate: string | null }>;
  entries: Array<{ id: string; date: string; narration: string; debitAcc: string; creditAcc: string; amount: number }>;
  notes: Array<{ id: string; body: string; createdAt: string }>;
  totals: { leads: number; units: number; available: number; pipelineValue: number; collected: number };
  expiresAt: string;
}

export const getSandboxData = cache(async (userId: string): Promise<SandboxData> => {
  const { id } = await getOrCreateSandbox(userId);
  const [sandbox, leads, units, tasks, entries, notes] = await Promise.all([
    prisma.guestSandbox.findUnique({ where: { id }, select: { expiresAt: true } }),
    prisma.sandboxLead.findMany({ where: { sandboxId: id }, orderBy: { createdAt: 'desc' } }),
    prisma.sandboxUnit.findMany({ where: { sandboxId: id }, orderBy: [{ tower: 'asc' }, { number: 'asc' }] }),
    prisma.sandboxTask.findMany({ where: { sandboxId: id }, orderBy: [{ done: 'asc' }, { dueDate: 'asc' }] }),
    prisma.sandboxLedgerEntry.findMany({ where: { sandboxId: id }, orderBy: { date: 'desc' } }),
    prisma.sandboxNote.findMany({ where: { sandboxId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);

  const n = (d: unknown) => (d == null ? 0 : Number(d));
  const available = units.filter((u) => u.status === 'AVAILABLE').length;
  const pipelineValue = leads.reduce((s, l) => s + n(l.budget), 0);
  const collected = entries.filter((e) => e.debitAcc === 'Bank').reduce((s, e) => s + n(e.amount), 0);

  return {
    leads: leads.map((l) => ({ id: l.id, name: l.name, phone: l.phone, source: l.source, status: l.status, budget: l.budget == null ? null : n(l.budget), note: l.note })),
    units: units.map((u) => ({ id: u.id, tower: u.tower, number: u.number, typology: u.typology, areaSqft: u.areaSqft, price: n(u.price), status: u.status })),
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, done: t.done, dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null })),
    entries: entries.map((e) => ({ id: e.id, date: e.date.toISOString().slice(0, 10), narration: e.narration, debitAcc: e.debitAcc, creditAcc: e.creditAcc, amount: n(e.amount) })),
    notes: notes.map((x) => ({ id: x.id, body: x.body, createdAt: x.createdAt.toISOString() })),
    totals: { leads: leads.length, units: units.length, available, pipelineValue, collected },
    expiresAt: (sandbox?.expiresAt ?? new Date()).toISOString(),
  };
});

/** Housekeeping: drop sandboxes whose time is up. Called by the cron worker. */
export async function pruneExpiredSandboxes(): Promise<number> {
  const r = await prisma.guestSandbox.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => ({ count: 0 }));
  return r.count;
}

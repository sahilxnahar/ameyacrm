'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { computeCapitalGain } from '@/lib/tax/capital-gains';
import { computePocm } from '@/lib/finance/pocm';
import { msmeDueDate } from '@/server/services/msme-service';
import { ensure, toActionError } from './_helpers';

function asDate(s?: string | null): Date | null { if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; }
function num(n?: number | null): number { return n != null && Number.isFinite(n) ? n : 0; }

// ── 53. MSME payment clock ───────────────────────────────────────────────────
export interface MsmeClockInput { vendorId: string; vendorBillId: string; billDate: string; amount: number; udyamNo?: string | null; hasAgreement?: boolean }
export async function createMsmeClock(input: MsmeClockInput): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    await ensure('finance.ledger.manage');
    const billDate = asDate(input.billDate); if (!billDate) return { error: 'Bill date is required.' };
    if (!input.vendorId || !input.vendorBillId) return { error: 'Vendor and bill are required.' };
    const row = await prisma.msmePaymentClock.upsert({
      where: { vendorBillId: input.vendorBillId },
      update: { amount: num(input.amount), udyamNo: input.udyamNo?.trim() || null, billDate, dueDate: msmeDueDate(billDate, input.hasAgreement ?? true) },
      create: { vendorId: input.vendorId, vendorBillId: input.vendorBillId, amount: num(input.amount), udyamNo: input.udyamNo?.trim() || null, billDate, dueDate: msmeDueDate(billDate, input.hasAgreement ?? true) },
    });
    await writeAudit({ action: 'CREATE', entityType: 'MsmePaymentClock', entityId: row.id, summary: `MSME clock started — due ${row.dueDate.toISOString().slice(0, 10)}` });
    revalidatePath('/msme-tracker');
    return { ok: true, id: row.id };
  } catch (err) { return toActionError(err); }
}

/**
 * Record a supplier's bill AND start its 45-day clock, in one step.
 *
 * The clock could previously only be attached to a bill that was already in the
 * system, so an MSME bill that had just arrived meant: go to Billing, record it,
 * come back here, find it in the dropdown, start the clock. Four steps across two
 * screens, at exactly the moment the 45 days start running whether anybody does
 * that or not — s.43B(h) does not wait for the data entry.
 *
 * It deliberately goes through `createVendorBill` rather than writing the row
 * directly. A bill recorded here is a real bill: it must get its ledger entry,
 * its liability and its GST treatment identically to one typed on the Billing
 * screen. A second, quieter path into the books is how two screens end up
 * disagreeing about what is owed.
 */
export interface MsmeManualBillInput {
  vendorId: string;
  number: string;
  amount: number;
  gstAmount?: number;
  billDate: string;
  udyamNo?: string | null;
  hasAgreement?: boolean;
  notes?: string | null;
}

export async function createMsmeBillManually(
  input: MsmeManualBillInput,
): Promise<{ ok: true; id: string; number: string; dueDate: string } | { error: string }> {
  try {
    // Both permissions, because this genuinely does both things.
    await ensure('finance.ledger.manage');
    await ensure('billing.bill.manage');

    const billDate = asDate(input.billDate);
    if (!billDate) return { error: 'Bill date is required.' };
    if (!input.vendorId) return { error: 'Pick the supplier.' };
    if (!input.number?.trim()) return { error: 'The supplier\u2019s bill number is required.' };
    if (num(input.amount) <= 0) return { error: 'Enter the bill amount.' };

    const { createVendorBill } = await import('./billing');
    const created = await createVendorBill({
      number: input.number.trim(),
      vendorId: input.vendorId,
      amount: num(input.amount),
      gstAmount: num(input.gstAmount),
      billDate: input.billDate,
      notes: input.notes?.trim() || null,
    });
    if ('error' in created) return { error: created.error };
    if (!created.id) return { error: 'The bill was not saved. Nothing was recorded.' };

    const dueDate = msmeDueDate(billDate, input.hasAgreement ?? true);
    const clock = await prisma.msmePaymentClock.upsert({
      where: { vendorBillId: created.id },
      update: { amount: num(input.amount) + num(input.gstAmount), udyamNo: input.udyamNo?.trim() || null, billDate, dueDate },
      create: {
        vendorId: input.vendorId, vendorBillId: created.id,
        amount: num(input.amount) + num(input.gstAmount),
        udyamNo: input.udyamNo?.trim() || null, billDate, dueDate,
      },
    });
    await writeAudit({
      action: 'CREATE', entityType: 'MsmePaymentClock', entityId: clock.id,
      summary: `MSME bill ${input.number.trim()} entered by hand \u2014 due ${dueDate.toISOString().slice(0, 10)}`,
    });
    revalidatePath('/msme-tracker');
    revalidatePath('/billing');
    return { ok: true, id: clock.id, number: input.number.trim(), dueDate: dueDate.toISOString().slice(0, 10) };
  } catch (err) { return toActionError(err); }
}

// ── 54. Khata record ─────────────────────────────────────────────────────────
const KHATA = ['A_KHATA', 'B_KHATA', 'E_KHATA', 'NONE'] as const;
type Khata = (typeof KHATA)[number];
function asKhata(s?: string): Khata { return (KHATA as readonly string[]).includes(s ?? '') ? (s as Khata) : 'NONE'; }
export interface KhataInput { projectId?: string | null; khataType?: string; pid?: string | null; khataNo?: string | null; assessmentNo?: string | null; ownerName?: string | null; lastEcOn?: string | null; ecClear?: boolean }
export async function saveKhata(input: KhataInput, id?: string): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    await ensure('land.manage');
    const data = { projectId: input.projectId || null, khataType: asKhata(input.khataType), pid: input.pid?.trim() || null, khataNo: input.khataNo?.trim() || null, assessmentNo: input.assessmentNo?.trim() || null, ownerName: input.ownerName?.trim() || null, lastEcOn: asDate(input.lastEcOn), ecClear: input.ecClear ?? false };
    const row = id ? await prisma.khataRecord.update({ where: { id }, data }) : await prisma.khataRecord.create({ data });
    await writeAudit({ action: id ? 'UPDATE' : 'CREATE', entityType: 'KhataRecord', entityId: row.id, summary: `Khata ${data.khataType} ${data.pid ?? ''}` });
    revalidatePath('/khata-vault');
    return { ok: true, id: row.id };
  } catch (err) { return toActionError(err); }
}

// ── 55. Capital-gains scenario ───────────────────────────────────────────────
export interface CapitalGainInputA { leadId?: string | null; saleValue: number; indexedCost: number; section: '54' | '54F'; reinvestAmount: number }
export async function saveCapitalGainScenario(input: CapitalGainInputA): Promise<{ ok: true; id: string; result: ReturnType<typeof computeCapitalGain> } | { error: string }> {
  try {
    const ctx = await ensure('lead.view');
    const result = computeCapitalGain({ saleValue: num(input.saleValue), indexedCost: num(input.indexedCost), section: input.section === '54F' ? '54F' : '54', reinvestAmount: num(input.reinvestAmount) });
    const row = await prisma.capitalGainScenario.create({
      data: { leadId: input.leadId || null, saleValue: num(input.saleValue), indexedCost: num(input.indexedCost), section: input.section === '54F' ? '54F' : '54', reinvestAmount: num(input.reinvestAmount), exemptGain: result.exemptGain, taxSaved: result.taxSaved, createdById: ctx.user.id },
    });
    revalidatePath('/capital-gains');
    return { ok: true, id: row.id, result };
  } catch (err) { return toActionError(err); }
}

// ── 51. POCM revenue snapshot ────────────────────────────────────────────────
export interface PocmInputA { projectId: string; period: string; costToDate: number; totalEstCost: number; totalContractVal: number }
export async function snapshotPocmRevenue(input: PocmInputA): Promise<{ ok: true } | { error: string }> {
  try {
    await ensure('finance.ledger.manage');
    if (!/^\d{4}-\d{2}$/.test(input.period)) return { error: 'Period must be YYYY-MM.' };
    const prior = await prisma.revenueRecognition.aggregate({ where: { projectId: input.projectId, period: { lt: input.period } }, _sum: { revenueThisPeriod: true } }).catch(() => ({ _sum: { revenueThisPeriod: null } }));
    const r = computePocm({ costToDate: num(input.costToDate), totalEstCost: num(input.totalEstCost), totalContractVal: num(input.totalContractVal), revenueRecognisedSoFar: Number(prior._sum.revenueThisPeriod ?? 0) });
    await prisma.revenueRecognition.upsert({
      where: { projectId_period: { projectId: input.projectId, period: input.period } },
      update: { costToDate: num(input.costToDate), totalEstCost: num(input.totalEstCost), totalContractVal: num(input.totalContractVal), pocmPercent: r.pocmPercent, revenueToDate: r.revenueToDate, revenueThisPeriod: r.revenueThisPeriod },
      create: { projectId: input.projectId, period: input.period, costToDate: num(input.costToDate), totalEstCost: num(input.totalEstCost), totalContractVal: num(input.totalContractVal), pocmPercent: r.pocmPercent, revenueToDate: r.revenueToDate, revenueThisPeriod: r.revenueThisPeriod },
    });
    revalidatePath('/revenue-recognition');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

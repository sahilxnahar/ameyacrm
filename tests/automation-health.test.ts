import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/prisma', () => ({ prisma: {} }));

const { runWithBudget, assessRuns } = await import('../src/server/services/automation-log');

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

/*
 * Twenty-one scheduled jobs ran in one 60-second pass with no record kept of
 * whether the pass had ever happened. It could be dead three ways, all silent:
 * CRON_SECRET unset (the endpoint fail-closes and refuses the scheduler), the
 * function limit killing the back half of the queue, or a job throwing into a
 * catch whose only output was an HTTP body nobody reads.
 *
 * These lock the three things that make it verifiable again.
 */
describe('the run stops before the host kills it', () => {
  it('records every step that ran', async () => {
    const run = await runWithBudget([
      { step: 'one', run: async () => 3 },
      { step: 'two', run: async () => ({ flagged: 2, notified: 1 }) },
    ], 10_000);
    expect(run.steps.map((s) => s.step)).toEqual(['one', 'two']);
    expect(run.steps.every((s) => s.ok)).toBe(true);
    expect(run.steps[0]!.detail).toBe('3');
    expect(run.steps[1]!.detail).toContain('flagged: 2');
    expect(run.truncated).toBe(false);
  });

  it('keeps going when one job throws, and says which', async () => {
    // The whole point of isolating each step: one bad job must not stop the rest.
    const run = await runWithBudget([
      { step: 'good', run: async () => 1 },
      { step: 'bad', run: async () => { throw new Error('provider refused'); } },
      { step: 'also good', run: async () => 2 },
    ], 10_000);
    expect(run.steps).toHaveLength(3);
    expect(run.steps[1]!.ok).toBe(false);
    expect(run.steps[1]!.detail).toContain('provider refused');
    expect(run.steps[2]!.ok).toBe(true);
  });

  it('names the jobs it skipped rather than leaving them merely absent', async () => {
    const run = await runWithBudget([
      { step: 'slow', run: () => new Promise((r) => setTimeout(r, 60)) },
      { step: 'never reached', run: async () => 1 },
      { step: 'nor this', run: async () => 2 },
    ], 20);
    expect(run.truncated).toBe(true);
    expect(run.skipped).toEqual(['never reached', 'nor this']);
    // Crucially, the log still exists — a killed function would have written nothing.
    expect(run.steps).toHaveLength(1);
  });
});

describe('health is reported in words a person can act on', () => {
  const at = (iso: string) => new Date(iso);
  const runAt = (iso: string, over: Partial<{ truncated: boolean; skipped: string[]; steps: Array<{ step: string; ok: boolean; detail: string; ms: number }> }> = {}) => ({
    startedAt: iso, finishedAt: iso, ms: 1200, truncated: false, skipped: [],
    steps: [{ step: 'MSME 45-day clocks', ok: true, detail: 'done', ms: 10 }],
    ...over,
  });

  it('says CRON_SECRET when nothing has ever run', () => {
    const res = assessRuns([], at('2026-08-04T06:00:00Z'));
    expect(res.state).toBe('never');
    expect(res.summary).toContain('CRON_SECRET');
  });

  it('treats a 25-hour gap as fine and a 40-hour gap as stale', () => {
    // Once a day means a 25-hour gap is a clock drifting, not a fault.
    expect(assessRuns([runAt('2026-08-03T05:00:00Z')] as never, at('2026-08-04T06:00:00Z')).state).toBe('healthy');
    const stale = assessRuns([runAt('2026-08-02T14:00:00Z')] as never, at('2026-08-04T06:00:00Z'));
    expect(stale.state).toBe('stale');
    expect(stale.summary).toMatch(/MSME clocks|no demands raised/);
  });

  it('flags a truncated run and names what was skipped', () => {
    const r = assessRuns([runAt('2026-08-04T01:00:00Z', {
      truncated: true, skipped: ['Nightly backup', 'Daily briefing'],
    })] as never, at('2026-08-04T06:00:00Z'));
    expect(r.state).toBe('truncated');
    expect(r.summary).toContain('Nightly backup');
  });

  it('flags a failing job by name', () => {
    const r = assessRuns([runAt('2026-08-04T01:00:00Z', {
      steps: [{ step: 'GSTR-2B reconciliation', ok: false, detail: 'boom', ms: 5 }],
    })] as never, at('2026-08-04T06:00:00Z'));
    expect(r.state).toBe('failing');
    expect(r.summary).toContain('GSTR-2B reconciliation');
  });
});

describe('the schedule and the Run now button share one code path', () => {
  it('the cron route only authenticates and delegates', () => {
    const route = read('src/app/api/cron/daily/route.ts');
    expect(route).toContain('runAndRecordNightlyPass');
    // The steps must not be duplicated in the route, or "Run now" would be
    // testing something other than what the scheduler runs.
    expect(route).not.toContain('sweepMsmeClocks');
  });

  it('the Run now action calls the same service', () => {
    expect(read('src/server/actions/scheduled-jobs.ts')).toContain("import('@/server/services/nightly-pass')");
  });

  it('runs the statutory clocks before the expensive housekeeping', () => {
    // Order is load-bearing: if the budget runs out, lose a backup that can be
    // retaken, not a s.43B(h) clock that quietly stopped ticking.
    const pass = read('src/server/services/nightly-pass.ts');
    expect(pass.indexOf('MSME 45-day clocks')).toBeLessThan(pass.indexOf('Nightly backup'));
    expect(pass.indexOf('Payment demands')).toBeLessThan(pass.indexOf('Daily briefing'));
    expect(pass.indexOf('GSTR-2B reconciliation')).toBeLessThan(pass.indexOf('Nightly backup'));
  });

  it('leaves room to write the log before the host limit', () => {
    const pass = read('src/server/services/nightly-pass.ts');
    const route = read('src/app/api/cron/daily/route.ts');
    const budget = Number(/BUDGET_MS = ([\d_]+)/.exec(pass)?.[1]?.replace(/_/g, ''));
    const max = Number(/maxDuration = (\d+)/.exec(route)?.[1]) * 1000;
    expect(budget).toBeLessThan(max);
    expect(max - budget).toBeGreaterThanOrEqual(5000);
  });
});

describe('manual entry exists where it was upload-only', () => {
  it('an MSME bill can be typed, not only picked from existing bills', () => {
    const src = read('src/components/finance/msme-tracker-view.tsx');
    expect(src).toContain('ManualMsmeBill');
    expect(src).toContain('createMsmeBillManually');
  });

  it('the manual MSME bill goes through the normal billing path, not a private write', () => {
    // A second, quieter route into the books is how two screens end up
    // disagreeing about what is owed.
    const src = read('src/server/actions/finance-tax.ts');
    expect(src).toMatch(/createMsmeBillManually[\s\S]*createVendorBill/);
    expect(src).toMatch(/createMsmeBillManually[\s\S]*prisma\.msmePaymentClock\.upsert/);
  });

  it('a GSTR-2B line can be typed, and the upload still wins over it', () => {
    const view = read('src/components/finance/gstr-recon-view.tsx');
    expect(view).toContain('ManualGstrLine');
    const action = read('src/server/actions/gstr.ts');
    // Same unique key as the import, so a later upload overwrites the typed line.
    expect(action).toMatch(/addGstr2bLine[\s\S]*supplierGstin_invoiceNo_period/);
  });
});

describe('a hand-run leaves a trace', () => {
  it('Run now records the run, like the scheduler does', () => {
    // It called `runNightlyPass` at first, which runs everything and records
    // nothing — a hand-run that leaves no trace is exactly the hole this panel
    // exists to close, and it would have left the "never run" warning showing
    // after a run that genuinely happened.
    const src = read('src/server/actions/scheduled-jobs.ts');
    expect(src).toContain('runAndRecordNightlyPass');
    expect(src).not.toMatch(/await runNightlyPass\(/);
  });
});

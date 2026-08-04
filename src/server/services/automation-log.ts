import 'server-only';
import { prisma } from '@/lib/db/prisma';

/**
 * A record of what the nightly automation actually did.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Twenty-one scheduled jobs run in one pass — the MSME 45-day clocks, the
 * demand cycle, GSTR reconciliation, statutory deadline sweeps, the backup.
 * Until now nothing anywhere recorded whether that pass had ever run. Three
 * separate ways it could be dead, all of them silent:
 *
 *   1. `CRON_SECRET` unset in the host. The endpoint fail-closes with a 503 —
 *      correct for security, and it means every automation in the product is
 *      switched off with no symptom other than things quietly not happening.
 *   2. The 60-second function limit. The jobs run in sequence, so a slow step
 *      halfway down kills everything below it. The response never arrives, so
 *      nobody learns which half ran.
 *   3. A step throwing. Each is wrapped in try/catch — deliberately, so one
 *      failure cannot stop the rest — and the failure was reported only in an
 *      HTTP response body that no human ever reads.
 *
 * An automation you cannot verify is not an automation, it is a hope. This
 * writes the outcome where the app can show it.
 *
 * ── Why the Setting table ───────────────────────────────────────────────────
 *
 * A JSON row in `Setting`, not a new table: no migration for anyone to run, and
 * the run log is genuinely a single mutable value rather than a growing ledger.
 * The last 14 runs are kept, which is enough to see a pattern and small enough
 * that the row stays a few kilobytes.
 */

const KEY = 'automation.runs';
const KEEP = 14;

export interface StepResult {
  /** The step's name, as a person would say it. */
  step: string;
  ok: boolean;
  /** What it did, in plain words — "3 clocks flipped to overdue". */
  detail: string;
  ms: number;
}

export interface AutomationRun {
  startedAt: string;
  finishedAt: string;
  ms: number;
  /** True when the time budget ran out and later steps were skipped. */
  truncated: boolean;
  /** Steps that never got to run because the budget ran out. */
  skipped: string[];
  steps: StepResult[];
}

/** Read the run history, newest first. Never throws — this is diagnostics. */
export async function readRuns(): Promise<AutomationRun[]> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    const v = row?.value as unknown;
    return Array.isArray(v) ? (v as AutomationRun[]) : [];
  } catch {
    return [];
  }
}

/** Append a run, keeping the most recent {@link KEEP}. */
export async function recordRun(run: AutomationRun): Promise<void> {
  try {
    const runs = [run, ...(await readRuns())].slice(0, KEEP);
    await prisma.setting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: runs as never },
      update: { value: runs as never },
    });
  } catch {
    /* Diagnostics must never be the reason the automation fails. */
  }
}

export interface AutomationHealth {
  lastRunAt: string | null;
  hoursAgo: number | null;
  /** 'never' | 'stale' | 'failing' | 'truncated' | 'healthy' */
  state: 'never' | 'stale' | 'failing' | 'truncated' | 'healthy';
  /** One sentence a person can act on. */
  summary: string;
  failedSteps: string[];
  lastRun: AutomationRun | null;
  runs: AutomationRun[];
}

/**
 * Is the automation actually working?
 *
 * "Stale" is set at 36 hours rather than 24: the pass runs once a day, so a
 * 25-hour gap is a clock drifting, not a fault. Past 36 hours a run has been
 * properly missed.
 */
export async function automationHealth(now = new Date()): Promise<AutomationHealth> {
  return assessRuns(await readRuns(), now);
}

/**
 * The judgement, as a pure function of the run history.
 *
 * Split out from `automationHealth` so it can be tested without a database —
 * the interesting logic is entirely "given these runs and this clock, what
 * should a person be told", and that deserves to be checkable directly.
 */
export function assessRuns(runs: AutomationRun[], now = new Date()): AutomationHealth {
  const last = runs[0] ?? null;

  if (!last) {
    return {
      lastRunAt: null, hoursAgo: null, state: 'never', failedSteps: [], lastRun: null, runs,
      summary:
        'The nightly automation has never run. The usual cause is CRON_SECRET not being set on the host — '
        + 'without it the endpoint refuses every request, including the scheduler’s, and every automation '
        + 'in the product is silently switched off.',
    };
  }

  const hoursAgo = (now.getTime() - new Date(last.finishedAt).getTime()) / 3_600_000;
  const failedSteps = last.steps.filter((s) => !s.ok).map((s) => s.step);

  if (hoursAgo > 36) {
    return {
      lastRunAt: last.finishedAt, hoursAgo, state: 'stale', failedSteps, lastRun: last, runs,
      summary: `The automation last ran ${Math.round(hoursAgo)} hours ago and should run daily. `
        + 'Nothing has been swept since — no MSME clocks moved, no demands raised, no backup taken.',
    };
  }
  if (last.truncated) {
    return {
      lastRunAt: last.finishedAt, hoursAgo, state: 'truncated', failedSteps, lastRun: last, runs,
      summary: `The last run ran out of time and stopped early, so ${last.skipped.length} job(s) did not run: `
        + `${last.skipped.slice(0, 4).join(', ')}${last.skipped.length > 4 ? '…' : ''}. `
        + 'They will be attempted first on the next run.',
    };
  }
  if (failedSteps.length) {
    return {
      lastRunAt: last.finishedAt, hoursAgo, state: 'failing', failedSteps, lastRun: last, runs,
      summary: `The automation ran ${Math.round(hoursAgo)} hours ago but ${failedSteps.length} job(s) failed: `
        + `${failedSteps.join(', ')}. Everything else completed.`,
    };
  }
  return {
    lastRunAt: last.finishedAt, hoursAgo, state: 'healthy', failedSteps: [], lastRun: last, runs,
    summary: `All ${last.steps.length} jobs completed ${Math.round(hoursAgo)} hour(s) ago in ${(last.ms / 1000).toFixed(1)}s.`,
  };
}

/**
 * Runs the steps in order, within a time budget, recording every one.
 *
 * The budget matters because the host kills the function at a hard limit and a
 * killed function writes nothing at all — you lose both the work and the
 * knowledge of how far it got. Stopping voluntarily a few seconds early means
 * the log always gets written, and the steps that were skipped are named rather
 * than merely absent.
 */
export async function runWithBudget(
  steps: Array<{ step: string; run: () => Promise<unknown> }>,
  budgetMs: number,
  now = new Date(),
): Promise<AutomationRun> {
  const started = now.getTime();
  const results: StepResult[] = [];
  const skipped: string[] = [];
  let truncated = false;

  for (const [i, s] of steps.entries()) {
    if (Date.now() - started > budgetMs) {
      truncated = true;
      skipped.push(...steps.slice(i).map((x) => x.step));
      break;
    }
    const t0 = Date.now();
    try {
      const out = await s.run();
      results.push({ step: s.step, ok: true, detail: describe(out), ms: Date.now() - t0 });
    } catch (e) {
      results.push({
        step: s.step, ok: false, ms: Date.now() - t0,
        detail: e instanceof Error ? e.message.slice(0, 200) : 'failed',
      });
    }
  }

  const finished = new Date();
  return {
    startedAt: new Date(started).toISOString(),
    finishedAt: finished.toISOString(),
    ms: finished.getTime() - started,
    truncated, skipped, steps: results,
  };
}

/** Turn whatever a job returned into a short line a person can read. */
function describe(out: unknown): string {
  if (out == null) return 'done';
  if (typeof out === 'number') return String(out);
  if (typeof out === 'string') return out.slice(0, 120);
  if (typeof out === 'object') {
    const entries = Object.entries(out as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${v}`);
    return entries.length ? entries.join(' · ') : 'done';
  }
  return 'done';
}

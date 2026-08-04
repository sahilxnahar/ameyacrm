'use client';
import * as React from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, CheckCircle2, Clock, Play, RefreshCw, XCircle, KeyRound, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getScheduledJobs, runScheduledJobsNow, type ScheduledJobsState } from '@/server/actions/scheduled-jobs';
import { cn } from '@/lib/utils/cn';

/**
 * Is the nightly automation actually running?
 *
 * Everything below the surface of this product runs from one scheduled pass —
 * the MSME 45-day clocks, the payment demands, the statutory deadline sweeps,
 * the backup. There was no way to tell whether it had ever run. It could be
 * dead in three silent ways: the host missing CRON_SECRET (the endpoint
 * fail-closes and refuses even the scheduler), the 60-second limit killing the
 * back half of the queue, or an individual job throwing into a catch block whose
 * only output was an HTTP response nobody reads.
 *
 * An automation you cannot verify is not an automation, it is a hope. This is
 * the page that turns it back into a fact.
 */
export function ScheduledJobsPanel() {
  const [state, setState] = React.useState<ScheduledJobsState | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    getScheduledJobs().then((r) => {
      setLoading(false);
      if ('error' in r) { setErr(r.error); return; }
      setErr(null); setState(r);
    });
  }, []);
  React.useEffect(load, [load]);

  const runNow = () => {
    setRunning(true);
    runScheduledJobsNow().then((r) => {
      setRunning(false);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(r.summary);
      load();
    });
  };

  if (loading && !state) {
    return <Card className="mb-6 p-5"><p className="text-sm text-muted-foreground">Checking the schedule…</p></Card>;
  }
  if (err) {
    return <Card className="mb-6 p-5"><p className="text-sm text-destructive">{err}</p></Card>;
  }
  if (!state) return null;

  const TONE = {
    never: { ring: 'border-destructive/40 bg-destructive/5', Icon: XCircle, text: 'text-destructive' },
    stale: { ring: 'border-destructive/40 bg-destructive/5', Icon: AlertTriangle, text: 'text-destructive' },
    failing: { ring: 'border-warning/50 bg-warning/10', Icon: AlertTriangle, text: 'text-brass-deep dark:text-brass-light' },
    truncated: { ring: 'border-warning/50 bg-warning/10', Icon: Clock, text: 'text-brass-deep dark:text-brass-light' },
    healthy: { ring: 'border-success/40 bg-success/5', Icon: CheckCircle2, text: 'text-success' },
  }[state.state];
  const { Icon } = TONE;

  return (
    <Card className={cn('mb-6 border p-5', TONE.ring)}>
      <div className="toolbar items-start gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', TONE.text)} aria-hidden />
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold">Scheduled jobs</h3>
            <p className="mt-0.5 max-w-[70ch] text-sm text-muted-foreground">{state.summary}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button onClick={runNow} disabled={running} className="gap-1.5">
            <Play className="h-4 w-4" /> {running ? 'Running…' : 'Run now'}
          </Button>
        </div>
      </div>

      {/*
        The single most common cause of "none of the automations work", and the
        hardest to guess at, because the symptom is nothing happening at all.
      */}
      {!state.cronSecretSet && (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold text-destructive">CRON_SECRET is not set on the server.</p>
            <p className="mt-0.5 max-w-[70ch] text-muted-foreground">
              The scheduled endpoint refuses every request without it — including the scheduler&rsquo;s own — so
              nothing runs on its own, whatever the schedule says. Add <code className="rounded bg-muted px-1 font-mono text-xs">CRON_SECRET</code> to
              your environment variables (any long random string), then redeploy. The <strong>Run now</strong> button
              above works regardless, because it runs in-process rather than over HTTP.
            </p>
          </div>
        </div>
      )}

      {state.lastRun && (
        <div className="mt-4">
          <button
            type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
            className="focus-ring flex items-center gap-1.5 rounded text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
            {open ? 'Hide' : 'Show'} the {state.lastRun.steps.length} jobs from the last run
          </button>

          {open && (
            <div className="record-list mt-3 overflow-hidden rounded-lg border">
              {state.lastRun.steps.map((s) => (
                <div key={s.step} className="flex items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0">
                  {s.ok
                    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
                    : <XCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />}
                  <span className="w-52 shrink-0 truncate font-medium">{s.step}</span>
                  <span className={cn('min-w-0 flex-1 truncate', s.ok ? 'text-muted-foreground' : 'text-destructive')}>
                    {s.detail}
                  </span>
                  <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{s.ms}ms</span>
                </div>
              ))}
              {state.lastRun.skipped.map((name) => (
                <div key={name} className="flex items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 opacity-70">
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="w-52 shrink-0 truncate font-medium">{name}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    Not reached — the run stopped at its time budget. Runs first next time.
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {state.runs.length > 1 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Last {state.runs.length} runs:{' '}
          {state.runs.map((r, i) => (
            <span key={r.startedAt} className={cn(
              'font-mono',
              r.truncated || r.steps.some((s) => !s.ok) ? 'text-destructive' : 'text-success',
            )}>
              {r.truncated || r.steps.some((s) => !s.ok) ? '✕' : '✓'}{i < state.runs.length - 1 ? ' ' : ''}
            </span>
          ))}
          {' '}· newest first
        </p>
      )}
    </Card>
  );
}

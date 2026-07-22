import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { getHealthReport, type Health, type Subsystem } from '@/server/services/health-service';
import { CheckCircle2, AlertTriangle, XCircle, Activity, Gauge, Bot } from 'lucide-react';

export const metadata: Metadata = { title: 'System Health' };
export const dynamic = 'force-dynamic';

const DOT: Record<Health, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  down: 'bg-destructive',
};
const RING: Record<Health, string> = {
  ok: 'border-emerald-500/30',
  warn: 'border-amber-500/40',
  down: 'border-destructive/50',
};
const OVERALL_LABEL: Record<Health, string> = {
  ok: 'All systems healthy',
  warn: 'Running, with a few things to look at',
  down: 'Something needs attention',
};

function StatusIcon({ status }: { status: Health }) {
  if (status === 'ok') return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  if (status === 'warn') return <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

function Tile({ s }: { s: Subsystem }) {
  return (
    <div className={`card-elevated flex items-start gap-3 border p-3.5 ${RING[s.status]}`}>
      <StatusIcon status={s.status} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{s.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p>
      </div>
    </div>
  );
}

export default async function SystemHealthPage() {
  await requirePermission('admin.setting.manage');
  try {
    const r = await getHealthReport();
    return (
      <div className="space-y-6">
        <PageHeader title="System Health" description="A live, at-a-glance board of every part of the ecosystem and whether it's working. Measured right now — reload to check again." />

        {/* Overall banner */}
        <div className={`card-elevated flex items-center gap-3 border p-4 ${RING[r.overall]}`}>
          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${DOT[r.overall]}/15`}>
            <span className={`h-3 w-3 rounded-full ${DOT[r.overall]}`} />
          </span>
          <div>
            <p className="text-base font-semibold">{OVERALL_LABEL[r.overall]}</p>
            <p className="text-xs text-muted-foreground">Checked {r.checkedAt.toLocaleString('en-IN')}</p>
          </div>
        </div>

        {/* Core subsystems */}
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Core</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {r.core.map((s) => <Tile key={s.key} s={s} />)}
          </div>
        </section>

        {/* Integrations / capabilities */}
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Integrations</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {r.capabilities.map((s) => <Tile key={s.key} s={s} />)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Amber here just means “not connected yet” — every one of these is optional and the CRM runs fine without it.</p>
        </section>

        {/* Live numbers */}
        {r.stats.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Right now</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {r.stats.map((st) => (
                <div key={st.label} className="card-elevated border p-3.5">
                  <p className="text-2xl font-semibold tabular-nums">{st.value}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{st.label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Deep links to the detailed views */}
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Dig deeper</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/admin/performance" className="card-elevated flex items-center gap-3 border p-3.5 transition-colors hover:border-primary hover:bg-secondary/40">
              <Gauge className="h-5 w-5 text-primary" />
              <div><p className="text-sm font-semibold">Performance</p><p className="text-xs text-muted-foreground">Live speed probes & advice</p></div>
            </Link>
            <Link href="/admin/ai-health" className="card-elevated flex items-center gap-3 border p-3.5 transition-colors hover:border-primary hover:bg-secondary/40">
              <Bot className="h-5 w-5 text-primary" />
              <div><p className="text-sm font-semibold">AI health</p><p className="text-xs text-muted-foreground">Provider & key-pool status</p></div>
            </Link>
            <Link href="/audit" className="card-elevated flex items-center gap-3 border p-3.5 transition-colors hover:border-primary hover:bg-secondary/40">
              <Activity className="h-5 w-5 text-primary" />
              <div><p className="text-sm font-semibold">Audit trail</p><p className="text-xs text-muted-foreground">Who did what, recently</p></div>
            </Link>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Slow queries (over {r.slowQueryMs} ms) are logged to the server console as they happen, so the worst offenders surface in your hosting logs.</p>
        </section>
      </div>
    );
  } catch (e) {
    return <div className="space-y-6"><PageHeader title="System Health" description="A live board of every part of the ecosystem." /><PageLoadError error={e} /></div>;
  }
}

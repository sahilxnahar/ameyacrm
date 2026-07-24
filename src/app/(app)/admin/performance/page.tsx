import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { measurePerformance } from '@/server/services/performance-service';
import { RepairButton } from '@/components/layout/repair-button';

export const metadata: Metadata = { title: 'Performance' };
export const dynamic = 'force-dynamic';

const TONE: Record<string, string> = {
  good: 'text-emerald-700 dark:text-emerald-400',
  slow: 'text-amber-700 dark:text-amber-500',
  bad: 'text-destructive',
};

export default async function PerformancePage() {
  await requirePermission('admin.setting.manage');
  const { pooled, region, probes, tables, advice } = await measurePerformance();

  return (
    <div className="space-y-6">
      <PageHeader title="Performance" description="Measured right now, on this deployment. Reload to run it again." />

      <div className={`card-elevated p-4 ${pooled ? '' : 'border-amber-400/60'}`}>
        <p className="text-sm">
          <strong>Database connection:</strong>{' '}
          {pooled
            ? <span className="text-emerald-700 dark:text-emerald-400">pooled — the right setting for Vercel</span>
            : <span className="text-amber-700 dark:text-amber-500">not pooled — every request opens a new connection</span>}
          {region && <span className="text-muted-foreground"> · {region}</span>}
        </p>
      </div>

      <div className="card-elevated overflow-hidden">
        <ul className="divide-y">
          {probes.map((p) => (
            <li key={p.name} className="flex flex-wrap items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-muted-foreground">{p.what}</p>
                <p className="mt-1 text-sm">{p.detail}</p>
              </div>
              <p className={`shrink-0 text-lg font-semibold tabular-nums ${TONE[p.verdict]}`}>{p.ms} ms</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="card-elevated p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">How much data is in here</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tables.map((t) => (
            <div key={t.model}>
              <dt className="text-xs text-muted-foreground">{t.model}</dt>
              <dd className="text-lg font-semibold tabular-nums">{t.rows < 0 ? '—' : t.rows.toLocaleString('en-IN')}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="card-elevated p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What to do about it</p>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {advice.map((a) => <li key={a}>{a}</li>)}
        </ul>
        {advice.some((a) => a.includes('behind the code')) && (
          <div className="mt-3"><RepairButton /></div>
        )}
      </div>
    </div>
  );
}

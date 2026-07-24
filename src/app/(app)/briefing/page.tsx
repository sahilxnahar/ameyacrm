import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';
import { requirePermission } from '@/lib/auth/current-user';
import { getBriefing } from '@/server/services/briefing-service';
import { isGeminiEnabled } from '@/lib/ai/gemini';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshBriefing } from '@/components/briefing/refresh-briefing';

export const metadata: Metadata = { title: 'Daily briefing' };

const TONE = { high: 'border-rose-500/40 bg-rose-500/10 text-rose-700', medium: 'border-amber-500/40 bg-amber-500/10 text-amber-700', low: 'border-slate-400/40 bg-slate-400/10 text-slate-600' } as const;

export default async function BriefingPage() {
  await requirePermission('dashboard.view');
  const { cached, signals } = await getBriefing();
  return (
    <div className="max-w-4xl">
      <PageHeader title="Daily briefing" description="What changed, what's at risk, and what to do about it today.">
        {isGeminiEnabled() && <RefreshBriefing />}
      </PageHeader>

      {cached ? (
        <Card className="mb-6 border-primary/30 bg-primary/5 p-5">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"><Sparkles className="h-4 w-4" /> AI summary</p>
          <p className="font-display text-xl font-semibold">{cached.headline}</p>
          <ul className="mt-4 space-y-1.5">
            {((cached.bullets as string[]) ?? []).map((b, i) => <li key={i} className="flex gap-2 text-sm"><span className="text-primary">•</span><span>{b}</span></li>)}
          </ul>
          {((cached.actions as string[]) ?? []).length > 0 && (
            <div className="mt-4 rounded-md border bg-background/60 p-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Do these today</p>
              <ol className="space-y-1">
                {((cached.actions as string[]) ?? []).map((a, i) => <li key={i} className="flex gap-2 text-sm font-medium"><span className="text-primary">{i + 1}.</span>{a}</li>)}
              </ol>
            </div>
          )}
        </Card>
      ) : (
        <Card className="mb-6 p-6 text-center text-sm text-muted-foreground">
          {isGeminiEnabled() ? 'No briefing generated yet today — hit Refresh above.' : 'Set GEMINI_API_KEY in Vercel to enable the AI summary. The risk signals below work regardless.'}
        </Card>
      )}

      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" /> Risks &amp; attention</h2>
      <div className="mb-6 space-y-2">
        {signals.alerts.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">Nothing needs attention. Clean board.</Card>}
        {signals.alerts.map((a, i) => (
          <Link key={i} href={a.href}>
            <Card className={`flex items-center justify-between border p-3 transition-colors hover:bg-secondary/40 ${TONE[a.severity]}`}>
              <div><p className="text-sm font-medium">{a.title}</p><p className="text-xs opacity-80">{a.detail}</p></div>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold">Today&apos;s numbers</h2>
      <Card className="grid grid-cols-2 gap-x-6 gap-y-3 p-5 sm:grid-cols-3">
        {Object.entries(signals.metrics).map(([k, v]) => (
          <div key={k}><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p><p className="text-sm font-semibold">{String(v)}</p></div>
        ))}
      </Card>
    </div>
  );
}

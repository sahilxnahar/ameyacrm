import type { Metadata } from 'next';
import {
  Sparkles, TrendingUp, Users2, Building2, IndianRupee, HardHat, ShieldCheck,
  ArrowUpRight, CheckCircle2,
} from 'lucide-react';
import { requireAuth } from '@/lib/auth/current-user';
import { GuestShell } from '@/components/layout/guest-shell';
import { NAVIGATION } from '@/config/navigation';

export const metadata: Metadata = { title: 'Product Preview' };
export const dynamic = 'force-dynamic';

// ── All figures below are ILLUSTRATIVE SAMPLE DATA. Hard-coded here on purpose:
// this page never reads the database, so a preview visitor cannot see any real
// company record. ──────────────────────────────────────────────────────────
const KPIS = [
  { label: 'Revenue booked (sample)', value: '₹42.6 Cr', delta: '+18% QoQ', icon: IndianRupee, tone: 'text-emerald-500' },
  { label: 'Active leads (sample)', value: '312', delta: '64 this week', icon: Users2, tone: 'text-rose-500' },
  { label: 'Units sold (sample)', value: '118 / 240', delta: '49% of inventory', icon: Building2, tone: 'text-blue-500' },
  { label: 'Collections (sample)', value: '₹31.9 Cr', delta: '92% on schedule', icon: TrendingUp, tone: 'text-amber-500' },
];

const PIPELINE = [
  { stage: 'New', n: 96 }, { stage: 'Contacted', n: 74 }, { stage: 'Site visit', n: 51 },
  { stage: 'Negotiation', n: 38 }, { stage: 'Booked', n: 27 }, { stage: 'Registered', n: 26 },
];

const SITE = [
  { tower: 'Tower A', pct: 82, milestone: '18th slab cast' },
  { tower: 'Tower B', pct: 61, milestone: 'Brickwork · 12th floor' },
  { tower: 'Tower C', pct: 34, milestone: 'RCC · 6th floor' },
];

const COMPLIANCE = [
  { label: 'RERA filings up to date', ok: true },
  { label: 'BOCW welfare logged this month', ok: true },
  { label: 'GST returns filed', ok: true },
  { label: 'Labour EPF/ESI validated', ok: true },
];

export default async function PreviewPage() {
  const { user } = await requireAuth();

  return (
    <GuestShell name={user.name}>
    <div className="space-y-8">
      {/* Hero */}
      <section className="rounded-2xl border bg-gradient-to-br from-primary/10 via-muted/40 to-background p-6 sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-background/70 px-2.5 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Ameya OS — live product preview
        </span>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Everything Ameya Heights runs on, in one place.</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
          A single operating system for an Indian real-estate developer — sales &amp; CRM, finance &amp; tax,
          construction &amp; site ops, legal &amp; due diligence, vendor &amp; labour compliance, procurement and
          corporate approvals. The numbers on this page are sample data so you can explore the product freely.
        </p>
      </section>

      {/* Sample KPIs */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">At a glance</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {KPIS.map((k) => (
            <div key={k.label} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between">
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted/60 ${k.tone}`}><k.icon className="h-5 w-5" /></span>
              </div>
              <div className="mt-3 text-2xl font-bold tabular-nums">{k.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{k.label}</div>
              <div className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{k.delta}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Sample module snapshots */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Users2 className="h-4 w-4 text-rose-500" /> Sales pipeline</h3>
          <div className="mt-3 space-y-2">
            {PIPELINE.map((s) => {
              const max = Math.max(...PIPELINE.map((p) => p.n));
              return (
                <div key={s.stage} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0 text-muted-foreground">{s.stage}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-rose-400" style={{ width: `${(s.n / max) * 100}%` }} /></span>
                  <span className="w-8 shrink-0 text-right tabular-nums font-medium">{s.n}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><HardHat className="h-4 w-4 text-amber-500" /> Construction progress</h3>
          <div className="mt-3 space-y-3">
            {SITE.map((t) => (
              <div key={t.tower}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{t.tower}</span>
                  <span className="tabular-nums text-muted-foreground">{t.pct}%</span>
                </div>
                <span className="mt-1 block h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${t.pct}%` }} /></span>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{t.milestone}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Compliance</h3>
          <div className="mt-3 space-y-2">
            {COMPLIANCE.map((c) => (
              <div key={c.label} className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>{c.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Every statutory obligation tracked with deadline alerts, so an inspection never finds a surprise.</p>
        </div>
      </section>

      {/* Full feature catalog (linkless showcase) */}
      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Everything in the platform</h2>
        <p className="mb-4 text-sm text-muted-foreground">Ninety-plus modules across the whole business. Here’s the full map.</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {NAVIGATION.map((group) => (
            <div key={group.label} className="rounded-xl border bg-card p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <ArrowUpRight className="h-4 w-4 text-primary" /> {group.label}
              </h3>
              {group.blurb ? <p className="mt-0.5 text-xs text-muted-foreground">{group.blurb}</p> : null}
              <ul className="mt-2.5 space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.label} className="flex items-start gap-2 text-xs">
                    <item.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="font-medium">{item.label}</span>
                      {item.blurb ? <span className="text-muted-foreground"> — {item.blurb}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <p className="pt-2 text-center text-xs text-muted-foreground">
        This preview shows the product’s capabilities with sample data only. A full account unlocks the live workspace.
      </p>
    </div>
    </GuestShell>
  );
}

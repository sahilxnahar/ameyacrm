'use client';
import * as React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { categorical, sequential, seriesColor, BAR_RADIUS_VERTICAL } from '@/config/chart-theme';
import { useChartMode } from '@/lib/hooks/use-chart-mode';

const inrCompact = (n: number) => {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}k`;
  return `₹${n}`;
};

export interface ChartsData {
  pipeline: Array<{ stage: string; count: number }>;
  sources: Array<{ name: string; value: number }>;
  cashflow: Array<{ month: string; In: number; Out: number }>;
}

export function DashboardCharts({ data }: { data: ChartsData }) {
  const mode = useChartMode();
  /*
   * The pipeline is a sequence, not a set of unrelated things: NEW → … → WON is
   * ordered, so it takes the sequential ramp and reads light-to-dark as a lead
   * gets closer to a sale. The old list was five near-identical navies (worst
   * adjacent pair ΔE 5.9 for normal vision) which conveyed neither order nor
   * difference. Lead SOURCES are unordered, so those take the categorical list.
   */
  const RAMP = sequential(mode);
  const PALETTE = categorical(mode);
  const hasPipeline = data.pipeline.some((p) => p.count > 0);
  const hasSources = data.sources.some((s) => s.value > 0);
  const hasCash = data.cashflow.some((c) => c.In > 0 || c.Out > 0);

  if (!hasPipeline && !hasSources && !hasCash) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {hasPipeline && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Lead pipeline</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.pipeline} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="stage" width={92} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} formatter={(v: number) => [v, 'leads']} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {data.pipeline.map((_, i) => <Cell key={i} fill={RAMP[Math.min(i, RAMP.length - 1)]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {hasSources && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Where leads come from</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.sources} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {data.sources.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number, n: string) => [v, n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {hasCash && (
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Cash flow — money in vs out (last 6 months)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.cashflow} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={inrCompact} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
                <Tooltip formatter={(v: number) => inrCompact(v)} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="In" fill={seriesColor(0, mode)} radius={BAR_RADIUS_VERTICAL} />
                <Bar dataKey="Out" fill={seriesColor(1, mode)} radius={BAR_RADIUS_VERTICAL} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

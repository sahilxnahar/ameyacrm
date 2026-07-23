'use client';
import * as React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Brand-led palette: navy + gold, then a small accessible accent set.
const NAVY = '#1B2A4A';
const GOLD = '#A07D34';
const PIPELINE = ['#9AA6C0', '#6E82AE', '#4A6091', '#33507F', '#25406B', '#A07D34', '#2E7D32'];
const CATEGORICAL = ['#1B2A4A', '#A07D34', '#4A6091', '#C2A05B', '#2E7D32', '#9B7BB8', '#3E8E9C', '#B5883F'];

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
                  {data.pipeline.map((_, i) => <Cell key={i} fill={PIPELINE[i % PIPELINE.length]} />)}
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
                  {data.sources.map((_, i) => <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />)}
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
                <Bar dataKey="In" fill={NAVY} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Out" fill={GOLD} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card } from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Badge } from '@/components/ui/badge';
import type { InsightsResult } from '@/server/services/insights-service';

const fmtNum = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtDate = (d: Date) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

export function InsightsView({ data }: { data: InsightsResult }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Cost anomalies" value={<AnimatedNumber value={data.anomalies.length} />} tone={data.anomalies.length > 0 ? 'bad' : 'good'} />
        <StatTile label="Materials checked" value={<AnimatedNumber value={data.materialsChecked} />} />
        <StatTile label="Leads scored" value={<AnimatedNumber value={data.leadsScored} />} spark={data.scoreBands.map((b) => b.count)} />
        <StatTile label="Score bands" value={<AnimatedNumber value={data.scoreBands.length} />} />
      </div>

      <Card className="p-4">
        <h3 className="mb-1 text-sm font-semibold">Cost anomalies</h3>
        <p className="mb-3 text-xs text-muted-foreground">Bills where the rate paid is well above the running rate for the same material — the ones worth a second look before they are approved.</p>
        {data.anomalies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No anomalies. Every material's bills sit close to its running rate.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-1.5">Voucher</th><th className="py-1.5">Material</th><th className="py-1.5 text-right">Rate</th><th className="py-1.5 text-right">Running rate</th><th className="py-1.5 text-right">Above by</th><th className="py-1.5">Date</th></tr></thead>
              <tbody>
                {data.anomalies.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-1.5">{a.number}</td>
                    <td className="py-1.5">{a.material}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtNum(a.value)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtNum(a.mean)}</td>
                    <td className="py-1.5 text-right"><Badge variant="destructive">+{fmtNum(a.deviationPct)}%</Badge></td>
                    <td className="py-1.5">{fmtDate(a.voucherDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-1 text-sm font-semibold">Lead-score distribution</h3>
        <p className="mb-3 text-xs text-muted-foreground">How the pipeline's scores are spread. A pile-up at the bottom (or everything maxed) means the scoring needs a look.</p>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.scoreBands} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="band" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

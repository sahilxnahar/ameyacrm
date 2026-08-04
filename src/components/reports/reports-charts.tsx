'use client';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { categorical, seriesColor, AXIS, GRID, TOOLTIP, BAR_RADIUS_VERTICAL, BAR_RADIUS_HORIZONTAL } from '@/config/chart-theme';
import { useChartMode } from '@/lib/hooks/use-chart-mode';

interface Datum { name: string; value: number }
export function ReportsCharts({ data }: { data: { tasksByStatus: Datum[]; tasksByPriority: Datum[]; departmentWorkload: { name: string; tasks: number }[]; leadsByStatus: Datum[] } }) {
  /*
   * The palette used to be six shades of brass declared at the top of this file.
   * Measured, its worst adjacent pair was ΔE 3.8 for readers with completely
   * normal colour vision — the same colour, in other words, so a six-slice pie
   * was conveying rather fewer than six categories. It now draws from the one
   * validated system in `chart-theme.ts`, which is also the only place dark
   * mode is handled.
   */
  const mode = useChartMode();
  const PALETTE = categorical(mode);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-lg">Tasks by status</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.tasksByStatus}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" tick={AXIS.tick} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={AXIS.tick} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="value" fill={seriesColor(0, mode)} radius={BAR_RADIUS_VERTICAL} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Department workload</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={data.departmentWorkload}>
              <XAxis type="number" allowDecimals={false} tick={AXIS.tick} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={110} tick={AXIS.tick} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="tasks" fill={seriesColor(1, mode)} radius={BAR_RADIUS_HORIZONTAL} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Tasks by priority</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.tasksByPriority} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {data.tasksByPriority.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip {...TOOLTIP} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Leads by stage</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.leadsByStatus}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis allowDecimals={false} tick={AXIS.tick} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="value" fill={seriesColor(2, mode)} radius={BAR_RADIUS_VERTICAL} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

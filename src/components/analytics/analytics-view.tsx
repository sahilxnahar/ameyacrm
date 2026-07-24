'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users2, TrendingUp, Home, Percent } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format';

interface Slice { name: string; value: number }
const UNIT_COLORS: Record<string, string> = { AVAILABLE: '#10b981', HELD: '#f59e0b', BOOKED: '#3b82f6', SOLD: '#f43f5e', BLOCKED: '#94a3b8' };
const BRASS = '#a07d34';
const pretty = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

function Kpi({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string | number; tone?: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone ?? 'bg-primary/10 text-primary'}`}><Icon className="h-5 w-5" /></div>
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></div>
    </Card>
  );
}
function Money({ label, paid, total }: { label: string; paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm"><span className="font-medium">{label}</span><span className="text-muted-foreground">{formatCurrency(paid)} / {formatCurrency(total)} · {pct}%</span></div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function AnalyticsView({ kpis, sources, statuses, inventory, money }: {
  kpis: { leads: number; bookings: number; won: number; conversion: number };
  sources: Slice[]; statuses: Slice[]; inventory: Slice[];
  money: { milestonesPaid: number; milestonesTotal: number; invoicePaid: number; invoiceTotal: number };
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Users2} label="Total leads" value={kpis.leads} />
        <Kpi icon={TrendingUp} label="Bookings" value={kpis.bookings} tone="bg-emerald-500/10 text-emerald-600" />
        <Kpi icon={Home} label="Booked / Won" value={kpis.won} tone="bg-blue-500/10 text-blue-600" />
        <Kpi icon={Percent} label="Lead → win rate" value={`${kpis.conversion}%`} tone="bg-amber-500/10 text-amber-600" />
      </div>

      <Card className="p-5">
        <p className="mb-4 text-sm font-semibold">Collections — collected vs projected</p>
        <div className="space-y-4">
          <Money label="Construction-linked payments" paid={money.milestonesPaid} total={money.milestonesTotal} />
          <Money label="Invoices" paid={money.invoicePaid} total={money.invoiceTotal} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <p className="mb-4 text-sm font-semibold">Leads by source</p>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={sources.map((s) => ({ name: pretty(s.name), value: s.value }))} margin={{ left: -20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill={BRASS} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <p className="mb-4 text-sm font-semibold">Inventory by status</p>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={inventory.map((s) => ({ name: pretty(s.name), value: s.value, key: s.name }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => `${e.name}: ${e.value}`}>
                  {inventory.map((s) => <Cell key={s.name} fill={UNIT_COLORS[s.name] ?? BRASS} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <p className="mb-4 text-sm font-semibold">Lead pipeline</p>
        <div className="space-y-2">
          {statuses.sort((a, b) => b.value - a.value).map((s) => {
            const max = Math.max(...statuses.map((x) => x.value), 1);
            return (
              <div key={s.name} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">{pretty(s.name)}</span>
                <div className="h-5 flex-1 overflow-hidden rounded bg-secondary"><div className="h-full rounded bg-primary/70" style={{ width: `${(s.value / max) * 100}%` }} /></div>
                <span className="w-8 text-right text-sm font-medium">{s.value}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

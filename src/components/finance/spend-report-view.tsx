'use client';
import * as React from 'react';
import { Download, PieChart, Building2, Users2, CalendarDays } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/format';
import type { SpendReport, SpendSlice } from '@/server/services/spend-report-service';

function SliceTable({ title, icon: Icon, slices, total }: { title: string; icon: typeof PieChart; slices: SpendSlice[]; total: number }) {
  const max = Math.max(1, ...slices.map((s) => s.total));
  return (
    <Card className="p-4">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Icon className="h-4 w-4 text-[#A07D34]" /> {title}</p>
      {slices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <ul className="space-y-2">
          {slices.map((s) => (
            <li key={s.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{s.label}</span>
                <span className="shrink-0 tabular-nums">{formatCurrency(s.total)} <span className="text-xs text-muted-foreground">({total > 0 ? Math.round((s.total / total) * 100) : 0}%)</span></span>
              </div>
              <span className="mt-0.5 block h-1.5 rounded bg-secondary">
                <span className="block h-full rounded bg-primary" style={{ width: `${(s.total / max) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function SpendReportView({ report, projectName }: { report: SpendReport; projectName: string }) {
  const exportCsv = () => {
    const lines: string[] = ['Section,Name,Amount,Payments'];
    const add = (section: string, slices: SpendSlice[]) => slices.forEach((s) => lines.push(`${section},"${s.label.replace(/"/g, '""')}",${Math.round(s.total)},${s.count}`));
    add('Category', report.byCategory);
    add('Payee', report.byVendor);
    add('Project', report.byProject);
    add('Month', report.byMonth);
    const a = document.createElement('a');
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(lines.join('\n'))}`;
    a.download = 'spend-report.csv';
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Card className="flex-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total paid out · {projectName}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCompactCurrency(report.total)}</p>
          <p className="text-xs text-muted-foreground">{report.count} payments</p>
        </Card>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SliceTable title="By category" icon={PieChart} slices={report.byCategory} total={report.total} />
        <SliceTable title="By project" icon={Building2} slices={report.byProject} total={report.total} />
        <SliceTable title="Top payees" icon={Users2} slices={report.byVendor} total={report.total} />
        <SliceTable title="By month" icon={CalendarDays} slices={report.byMonth} total={report.total} />
      </div>
    </div>
  );
}

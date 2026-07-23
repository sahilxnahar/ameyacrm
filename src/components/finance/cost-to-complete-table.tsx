import { Card } from '@/components/ui/card';
import { formatCompactCurrency } from '@/lib/utils/format';
import type { CostRow } from '@/server/services/cost-to-complete-service';

/**
 * Budget vs committed vs spent, per project — with what's left to complete.
 * Server component: pure presentation of already-aggregated numbers.
 */
export function CostToCompleteTable({ rows }: { rows: CostRow[] }) {
  return (
    <Card className="p-4">
      <p className="mb-1 text-sm font-semibold">Project cost-to-complete</p>
      <p className="mb-3 text-xs text-muted-foreground">Budget vs committed (POs) vs actually spent. Set a budget and tag payments to a project to fill this in.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr className="text-left">
              <th className="p-2">Project</th>
              <th className="p-2 text-right">Budget</th>
              <th className="p-2 text-right">Committed</th>
              <th className="p-2 text-right">Spent</th>
              <th className="p-2 text-right">To complete</th>
              <th className="p-2">Used</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No active projects.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.projectId} className="border-t">
                <td className="p-2 font-medium">{r.name}</td>
                <td className="p-2 text-right tabular-nums">{r.budget > 0 ? formatCompactCurrency(r.budget) : '—'}</td>
                <td className="p-2 text-right tabular-nums">{r.committed > 0 ? formatCompactCurrency(r.committed) : '—'}</td>
                <td className="p-2 text-right tabular-nums">{formatCompactCurrency(r.spent)}</td>
                <td className="p-2 text-right tabular-nums">{r.budget > 0 ? formatCompactCurrency(r.toComplete) : '—'}</td>
                <td className="p-2">
                  {r.budget > 0 ? (
                    <span className="flex items-center gap-2">
                      <span className="block h-1.5 w-20 rounded bg-secondary"><span className={`block h-full rounded ${r.pctUsed > 100 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${Math.min(100, r.pctUsed)}%` }} /></span>
                      <span className={`text-xs tabular-nums ${r.pctUsed > 100 ? 'text-destructive' : 'text-muted-foreground'}`}>{r.pctUsed}%</span>
                    </span>
                  ) : <span className="text-xs text-muted-foreground">no budget set</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Calculator, PiggyBank, Save } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RecordList } from '@/components/shared/record-row';
import { formatCurrency } from '@/lib/utils/format';
import { computeCapitalGain } from '@/lib/tax/capital-gains';
import { saveCapitalGainScenario } from '@/server/actions/finance-tax';

interface Recent { id: string; saleValue: number; section: string; exemptGain: number; taxSaved: number; createdAt: string }

export function CapitalGainsView({ recent }: { recent: Recent[] }) {
  const [saleValue, setSaleValue] = React.useState(10000000);
  const [indexedCost, setIndexedCost] = React.useState(4000000);
  const [section, setSection] = React.useState<'54' | '54F'>('54');
  const [reinvest, setReinvest] = React.useState(6000000);
  const [saving, setSaving] = React.useState(false);

  const r = computeCapitalGain({ saleValue, indexedCost, section, reinvestAmount: reinvest });

  function save() {
    setSaving(true);
    saveCapitalGainScenario({ saleValue, indexedCost, section, reinvestAmount: reinvest }).then((res) => {
      setSaving(false);
      if ('error' in res) { toast.error(res.error); return; }
      toast.success('Scenario saved'); location.reload();
    })
      .catch(() => {
        // A rejected server action never reaches .then, so the flag the
        // success path clears was never cleared: the button stayed disabled
        // with a spinner until someone reloaded the page.
        setSaving(false);
        toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
      });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium"><Calculator className="h-4 w-4" /> Inputs</div>
          <div><Label>Sale value / net consideration (₹)</Label><Input type="number" value={saleValue} onChange={(e) => setSaleValue(Number(e.target.value))} /></div>
          <div><Label>Indexed cost of acquisition (₹)</Label><Input type="number" value={indexedCost} onChange={(e) => setIndexedCost(Number(e.target.value))} /></div>
          <div>
            <Label>Section</Label>
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={section} onChange={(e) => setSection(e.target.value as '54' | '54F')}>
              <option value="54">Section 54 — sale of a residential house</option>
              <option value="54F">Section 54F — sale of any other long-term asset</option>
            </select>
          </div>
          <div><Label>Amount reinvested in new home (₹)</Label><Input type="number" value={reinvest} onChange={(e) => setReinvest(Number(e.target.value))} /></div>
          <Button onClick={save} disabled={saving} className="w-full gap-1"><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save scenario'}</Button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Capital gain" value={formatCurrency(r.gain)} icon={Calculator} />
            <StatCard label="Tax saved" value={formatCurrency(r.taxSaved)} icon={PiggyBank} tone="success" />
            <StatCard label="Exempt gain" value={formatCurrency(r.exemptGain)} icon={PiggyBank} tone="success" />
            <StatCard label="Taxable / tax payable" value={`${formatCurrency(r.taxableGain)} · ${formatCurrency(r.taxPayable)}`} icon={Calculator} tone={r.taxableGain ? 'warning' : 'default'} />
          </div>
          <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            LTCG on immovable property is taxed at 20% with indexation. Section 54 exempts the lesser of the gain and the amount reinvested;
            Section 54F exempts the gain in proportion to the sale proceeds reinvested. This is an indicative estimate — not tax advice; the
            buyer should confirm with their chartered accountant.
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">Saved scenarios</div>
        <RecordList empty="Model a sale under Section 54/54F here — sale value, indexed cost and the exemption you would claim — and save it to compare against another.">
          {recent.map((s) => (
            <div key={s.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">Sale {formatCurrency(s.saleValue)} · Section {s.section}</div>
                <div className="truncate text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString('en-IN')}</div>
              </div>
              <span className="shrink-0 text-sm font-semibold text-success">saves {formatCurrency(s.taxSaved)}</span>
            </div>
          ))}
        </RecordList>
      </div>
    </div>
  );
}

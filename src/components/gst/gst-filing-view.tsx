'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Download, FileJson, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { gstr1JsonForPeriod, eInvoiceJson, ewayBillJson } from '@/server/actions/gst-filing';

interface InvoiceRow { id: string; number: string; clientName: string; total: number; issued: string }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

function download(filename: string, json: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function GstFilingView({ invoices }: { invoices: InvoiceRow[] }) {
  const now = new Date();
  const [month, setMonth] = React.useState(now.getMonth() + 1);
  const [year, setYear] = React.useState(now.getFullYear());
  const [busy, setBusy] = React.useState<string | null>(null);
  const [q, setQ] = React.useState('');

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);
  const filtered = invoices.filter((r) => `${r.number} ${r.clientName}`.toLowerCase().includes(q.toLowerCase()));

  async function run(label: string, fn: () => Promise<{ ok: true; filename: string; json: string } | { error: string }>) {
    setBusy(label);
    const res = await fn();
    setBusy(null);
    if ('error' in res) { toast.error(res.error); return; }
    download(res.filename, res.json);
    toast.success(`${res.filename} downloaded`);
  }

  return (
    <div className="space-y-6">
      {/* GSTR-1 for a month */}
      <div className="rounded-lg border p-4">
        <div className="mb-1 flex items-center gap-2 font-semibold"><FileJson className="h-4 w-4 text-primary" /> GSTR-1 (monthly)</div>
        <p className="mb-3 text-sm text-muted-foreground">Outward-supplies return for a month — B2B, B2C (small) and the HSN summary, in the GST offline-tool JSON format.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Month</span>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-9 rounded-md border bg-background px-2 text-sm">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Year</span>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-9 rounded-md border bg-background px-2 text-sm">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <Button
            onClick={() => run('gstr1', () => gstr1JsonForPeriod(month, year))}
            disabled={busy === 'gstr1'}
            className="gap-1"
          >
            <Download className="h-4 w-4" /> {busy === 'gstr1' ? 'Building…' : 'Download GSTR-1 JSON'}
          </Button>
        </div>
      </div>

      {/* Per-invoice: e-invoice + e-way-bill */}
      <div className="rounded-lg border p-4">
        <div className="mb-1 flex items-center gap-2 font-semibold"><FileJson className="h-4 w-4 text-primary" /> E-invoice &amp; E-way-bill (per invoice)</div>
        <p className="mb-3 text-sm text-muted-foreground">Pick an invoice to generate its e-invoice (IRN) JSON for the IRP, or its e-way-bill JSON for the EWB portal. Transport and distance are completed on the portal.</p>
        <div className="relative mb-3 max-w-sm">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice number or client…" className="pl-8" />
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices found.</p>
        ) : (
          <div className="max-h-[50vh] divide-y overflow-y-auto rounded-md border">
            {filtered.map((r) => (
              <div key={r.id} className="toolbar items-center gap-2 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.number} · {r.clientName}</div>
                  <div className="text-xs text-muted-foreground">₹{inr.format(r.total)} · {new Date(r.issued).toLocaleDateString('en-IN')}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => run(`einv-${r.id}`, () => eInvoiceJson(r.id))} disabled={busy === `einv-${r.id}`} className="gap-1">
                    <Download className="h-3.5 w-3.5" /> E-invoice
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => run(`ewb-${r.id}`, () => ewayBillJson(r.id))} disabled={busy === `ewb-${r.id}`} className="gap-1">
                    <Download className="h-3.5 w-3.5" /> E-way-bill
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

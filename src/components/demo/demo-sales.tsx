'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { SandboxData } from '@/server/services/sandbox-service';
import { sandboxAddLead, sandboxSetLeadStatus, sandboxDeleteLead } from '@/server/actions/sandbox';
import { PageHead, ResetButton, useRunner, inr, Empty } from './demo-shared';

const STATUSES = ['NEW', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'LOST'] as const;

export function DemoSales({ data }: { data: SandboxData }) {
  const [pending, run] = useRunner();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', phone: '', source: 'Walk-in', budget: '', note: '' });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => sandboxAddLead({ ...form, budget: form.budget ? Number(form.budget) : undefined }), 'Lead added');
    setForm({ name: '', phone: '', source: 'Walk-in', budget: '', note: '' });
    setOpen(false);
  };

  const byStage = STATUSES.map((s) => ({ s, n: data.leads.filter((l) => l.status === s).length }));

  return (
    <div>
      <PageHead title="Sales & Leads" blurb="Capture an enquiry and move it through to a booking.">
        <ResetButton />
        <button type="button" onClick={() => setOpen((v) => !v)} className="focus-ring inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
          <Plus className="h-4 w-4" /> Add a lead
        </button>
      </PageHead>

      {/* Pipeline at a glance */}
      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {byStage.map(({ s, n }) => (
          <div key={s} className="rounded-md border bg-background p-2 text-center">
            <p className="font-display text-lg">{n}</p>
            <p className="text-[11px] text-muted-foreground">{s.replace('_', ' ')}</p>
          </div>
        ))}
      </div>

      {open && (
        <form onSubmit={submit} className="mb-4 grid gap-2 rounded-lg border bg-secondary/30 p-3 sm:grid-cols-2 lg:grid-cols-5">
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="rounded-md border bg-background px-2 py-1.5 text-sm" />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="rounded-md border bg-background px-2 py-1.5 text-sm" />
          <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="rounded-md border bg-background px-2 py-1.5 text-sm">
            {['Walk-in', 'Website', 'Referral', 'Portal', 'Campaign'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <input value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="Budget ₹" inputMode="numeric" className="rounded-md border bg-background px-2 py-1.5 text-sm" />
          <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Save lead</button>
        </form>
      )}

      {data.leads.length === 0 ? (
        <Empty>No leads yet — add one above.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-2">Name</th><th className="p-2">Source</th><th className="p-2">Budget</th><th className="p-2">Stage</th><th className="p-2 text-right">Remove</th></tr>
            </thead>
            <tbody>
              {data.leads.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="p-2">
                    <p className="font-medium">{l.name}</p>
                    {l.phone && <p className="text-xs text-muted-foreground">{l.phone}</p>}
                    {l.note && <p className="text-xs text-muted-foreground">{l.note}</p>}
                  </td>
                  <td className="p-2 text-muted-foreground">{l.source}</td>
                  <td className="p-2">{l.budget ? inr(l.budget) : '—'}</td>
                  <td className="p-2">
                    <select
                      value={l.status} disabled={pending} aria-label={`Stage for ${l.name}`}
                      onChange={(e) => run(() => sandboxSetLeadStatus(l.id, e.target.value), 'Stage updated')}
                      className="rounded border bg-background px-1.5 py-1 text-xs"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td className="p-2 text-right">
                    <button type="button" disabled={pending} onClick={() => run(() => sandboxDeleteLead(l.id), 'Lead removed')} aria-label={`Remove ${l.name}`} className="focus-ring rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

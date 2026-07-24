'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { ShieldCheck, Search, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { CONSENT_PURPOSES } from '@/lib/privacy/consent';
import { recordConsent, consentHistory } from '@/server/actions/consent';

interface Row { id: string; purpose: string; status: string; source: string | null; note: string | null; at: string }

export function ConsentManager() {
  const [who, setWho] = React.useState('');
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [, start] = React.useTransition();
  const [busy, setBusy] = React.useState(false);

  const purposeLabel = (k: string) => CONSENT_PURPOSES.find((p) => p.key === k)?.label ?? k;

  async function look() {
    if (!who.trim()) return;
    setBusy(true);
    const res = await consentHistory(who.trim());
    setBusy(false);
    if ('error' in res) { toast.error(res.error); return; }
    setRows(res.rows);
  }

  function set(purpose: string, status: 'GIVEN' | 'WITHDRAWN') {
    const isEmail = who.includes('@');
    start(async () => {
      const res = await recordConsent({
        subjectEmail: isEmail ? who.trim() : '', subjectPhone: isEmail ? '' : who.trim(),
        purpose, status,
      });
      if ('error' in res) { toast.error(res.error); return; }
      toast.success(`${purposeLabel(purpose)} — ${status === 'GIVEN' ? 'consent recorded' : 'withdrawal recorded'}`);
      look();
    });
  }

  const current: Record<string, string> = {};
  if (rows) for (const r of [...rows].reverse()) current[r.purpose] = r.status;

  return (
    <Card className="mt-6 p-4">
      <div className="mb-1 flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> Consent register</div>
      <p className="mb-3 text-sm text-muted-foreground">Look up a person by email or phone to see and update what they’ve agreed to. Every change is kept as an append-only trail, so a withdrawal never erases the earlier record.</p>
      <div className="flex max-w-md gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Email or phone" className="pl-8" onKeyDown={(e) => { if (e.key === 'Enter') look(); }} />
        </div>
        <Button onClick={look} disabled={busy || !who.trim()}>{busy ? 'Looking…' : 'Look up'}</Button>
      </div>

      {rows && (
        <div className="mt-4 space-y-2">
          {CONSENT_PURPOSES.map((p) => {
            const st = current[p.key];
            return (
              <div key={p.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-xs text-muted-foreground">{st ? (st === 'GIVEN' ? 'Consent given' : 'Withdrawn') : 'No record yet'}{p.blurb ? ` · ${p.blurb}` : ''}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant={st === 'GIVEN' ? 'default' : 'outline'} onClick={() => set(p.key, 'GIVEN')} className="gap-1"><Check className="h-3.5 w-3.5" /> Given</Button>
                  <Button size="sm" variant={st === 'WITHDRAWN' ? 'default' : 'outline'} onClick={() => set(p.key, 'WITHDRAWN')} className="gap-1"><X className="h-3.5 w-3.5" /> Withdraw</Button>
                </div>
              </div>
            );
          })}
          {rows.length > 0 && (
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Full trail ({rows.length})</summary>
              <ul className="mt-2 space-y-1">
                {rows.map((r) => (
                  <li key={r.id}>{new Date(r.at).toLocaleString()} · {purposeLabel(r.purpose)} · <strong>{r.status}</strong>{r.source ? ` · ${r.source}` : ''}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}

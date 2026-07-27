'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Loader2, Mail, CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Result {
  ok: boolean;
  stage?: string;
  config?: Record<string, unknown>;
  hints?: string[];
  error?: string;
  message?: string;
}

const CONFIG_LABEL: Record<string, string> = {
  provider: 'EMAIL_PROVIDER', from: 'EMAIL_FROM', host: 'SMTP_HOST', port: 'SMTP_PORT',
  secure: 'SMTP_SECURE', user: 'SMTP_USER', passPresent: 'Password set?', passMasked: 'Password',
  passLength: 'Password length', passHasSpaces: 'Password has spaces?',
};

export function EmailHealthView({ defaultTo }: { defaultTo: string }) {
  const [to, setTo] = React.useState(defaultTo);
  const [busy, setBusy] = React.useState<'check' | 'send' | null>(null);
  const [res, setRes] = React.useState<Result | null>(null);

  const run = (send: boolean) => {
    setBusy(send ? 'send' : 'check');
    setRes(null);
    void (async () => {
      try {
        const url = send ? `/api/admin/email-check?to=${encodeURIComponent(to)}` : '/api/admin/email-check';
        const r = await fetch(url);
        setRes((await r.json()) as Result);
      } catch {
        toast.error('Could not run the check.');
      } finally {
        setBusy(null);
      }
    })();
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base">Test email delivery</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Silent failure is the whole problem with email. This checks your actual mail settings and tells you exactly what&apos;s wrong.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[240px] flex-1">
            <label className="text-xs font-medium text-muted-foreground">Send test to</label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="you@example.com" className="mt-1" />
          </div>
          <Button variant="outline" onClick={() => run(false)} disabled={busy !== null}>
            {busy === 'check' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Check connection
          </Button>
          <Button onClick={() => run(true)} disabled={busy !== null || !to.trim()}>
            {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send test email
          </Button>
        </div>
      </Card>

      {res && (
        <Card className="p-5">
          <div className={`flex items-start gap-2 rounded-md p-3 text-sm ${res.ok ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'}`}>
            {res.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <div>
              <p className="font-medium">{res.ok ? 'OK' : `Failed at: ${res.stage ?? 'config'}`}</p>
              {res.message && <p>{res.message}</p>}
              {res.error && <p className="mt-1 font-mono text-xs">{res.error}</p>}
            </div>
          </div>

          {res.hints && res.hints.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What to fix</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {res.hints.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}

          {res.config && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current settings</p>
              <dl className="mt-1 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {Object.entries(res.config).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 text-sm">
                    <dt className="text-muted-foreground">{CONFIG_LABEL[k] ?? k}</dt>
                    <dd className="font-mono">{v === null ? '—' : String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

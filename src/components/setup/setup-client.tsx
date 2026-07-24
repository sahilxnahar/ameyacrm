'use client';
import * as React from 'react';
import { Database, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SetupResult {
  ok?: boolean; created?: boolean; message?: string; error?: string;
  credentials?: { username: string; email: string; password: string };
}

export function SetupClient({ appName }: { appName: string }) {
  const [status, setStatus] = React.useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [result, setResult] = React.useState<SetupResult | null>(null);

  const run = async () => {
    setStatus('running');
    try {
      const res = await fetch('/api/setup', { method: 'POST' });
      const data: SetupResult = await res.json();
      setResult(data);
      setStatus(res.ok && !data.error ? 'done' : 'error');
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Request failed (is the site reachable?)' });
      setStatus('error');
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Database className="h-6 w-6" />
        </div>
        <CardTitle>{appName} — First‑run setup</CardTitle>
        <CardDescription>Creates the database tables and your admin account. Run this once after deploying.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status !== 'done' && (
          <Button className="w-full" onClick={run} disabled={status === 'running'}>
            {status === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            {status === 'running' ? 'Setting up…' : 'Initialize database'}
          </Button>
        )}

        {status === 'done' && result?.credentials && (
          <div className="space-y-3 rounded-lg border bg-secondary/40 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-success"><CheckCircle2 className="h-4 w-4" /> Done! Your login:</p>
            <div className="space-y-1 font-mono text-xs">
              <div>Username: <b>{result.credentials.username}</b></div>
              <div>Email: <b>{result.credentials.email}</b></div>
              <div>Password: <b>{result.credentials.password}</b></div>
            </div>
            <p className="text-xs text-muted-foreground">You'll set a new password on first login.</p>
            <Button asChild className="w-full"><a href="/login">Go to login →</a></Button>
          </div>
        )}

        {status === 'done' && !result?.credentials && (
          <div className="space-y-2 rounded-lg border p-4 text-sm">
            <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4 text-success" /> {result?.message ?? 'Already initialized.'}</p>
            <Button asChild className="w-full"><a href="/login">Go to login →</a></Button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> Setup failed</p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(result, null, 2)}</pre>
            <p className="text-xs">Usually means <b>DATABASE_URL</b> is missing/incorrect. Fix it in Vercel, redeploy, and retry.</p>
            <Button variant="outline" className="w-full" onClick={run}>Try again</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Mail, Plug, CheckCircle2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { saveMyImap, testMyImap, clearMyImap } from '@/server/actions/user-imap';
import type { UserImapStatus } from '@/server/services/user-imap-service';

export function EmailSettingsView({ status, defaultEmail }: { status: UserImapStatus; defaultEmail: string }) {
  const [host, setHost] = React.useState(status.host ?? 'imap.gmail.com');
  const [port, setPort] = React.useState(status.port ?? 993);
  const [user, setUser] = React.useState(status.source === 'user' ? (status.user ?? '') : defaultEmail);
  const [pass, setPass] = React.useState('');
  const [busy, setBusy] = React.useState<null | 'save' | 'test'>(null);

  function save() {
    if (!user.trim()) { toast.error('Enter your email / IMAP username.'); return; }
    setBusy('save');
    saveMyImap({ host, port, user, pass }).then((r) => {
      setBusy(null);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Connected — your inbox is now syncing'); setPass(''); location.reload();
    });
  }
  function test() {
    setBusy('test');
    testMyImap().then((r) => { setBusy(null); if ('error' in r) { toast.error(r.error); return; } toast.success(`Connection OK (${r.source === 'user' ? 'your mailbox' : 'org mailbox'})`); });
  }
  function disconnect() {
    clearMyImap().then((r) => { if ('error' in r) { toast.error(r.error); return; } toast.success('Disconnected'); location.reload(); });
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        {status.source === 'user' ? <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Your mailbox connected</Badge>
          : status.source === 'org' ? <Badge variant="secondary" className="gap-1"><Mail className="h-3.5 w-3.5" /> Using the shared org mailbox</Badge>
          : <Badge variant="warning">No mailbox configured</Badge>}
        {status.user ? <span className="text-sm text-muted-foreground">{status.user}</span> : null}
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Email / IMAP username</Label><Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="you@ameyaheights.com" /></div>
          <div><Label>IMAP host</Label><Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="imap.gmail.com" /></div>
          <div><Label>Port</Label><Input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} /></div>
          <div className="col-span-2"><Label>App password</Label><Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={status.source === 'user' ? 'leave blank to keep the saved one' : 'Gmail app password'} /></div>
        </div>
        <p className="text-xs text-muted-foreground">Gmail: turn on IMAP and create an <b>app password</b> (not your login password). Your password is encrypted at rest and never shown again. Host defaults to <code>imap.gmail.com:993</code>.</p>
        <div className="flex gap-2">
          <Button onClick={save} disabled={busy !== null} className="gap-1"><Plug className="h-4 w-4" /> {busy === 'save' ? 'Connecting…' : 'Save & connect'}</Button>
          <Button variant="outline" onClick={test} disabled={busy !== null} className="gap-1"><CheckCircle2 className="h-4 w-4" /> {busy === 'test' ? 'Testing…' : 'Test connection'}</Button>
          {status.source === 'user' ? <Button variant="ghost" onClick={disconnect} className="gap-1 text-destructive"><Trash2 className="h-4 w-4" /> Disconnect</Button> : null}
        </div>
      </div>
    </div>
  );
}

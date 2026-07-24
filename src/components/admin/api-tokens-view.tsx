'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, Copy, Ban } from 'lucide-react';
import { createApiToken, revokeApiToken } from '@/server/actions/api-tokens';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface Tok { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revoked: boolean }

export function ApiTokensView({ tokens }: { tokens: Tok[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [fresh, setFresh] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form);
    start(async () => {
      const r = await createApiToken(String(fd.get('name') || ''));
      if ('error' in r) { toast.error(r.error); return; }
      setFresh(r.token ?? null); form.reset(); router.refresh(); toast.success('Token created — copy it now');
    });
  };
  const revoke = (id: string) => start(async () => { const r = await revokeApiToken(id); if ('error' in r) { toast.error(r.error); return; } toast.success('Revoked'); router.refresh(); });

  return (
    <div className="space-y-6">
      {fresh && (
        <Card className="border-emerald-500/40 bg-emerald-500/10 p-4">
          <p className="mb-1 text-sm font-semibold">Copy this token now — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-background/70 p-2 font-mono text-xs">{fresh}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(fresh); toast.success('Copied'); }}><Copy className="h-4 w-4" /></Button>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <form onSubmit={submit} className="flex gap-2">
          <Input name="name" placeholder="Token name e.g. Website integration" required />
          <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}<Plus className="h-4 w-4" /> Create</Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">Use as <code>Authorization: Bearer &lt;token&gt;</code> against <code>/api/v1/leads</code> and <code>/api/v1/units</code>.</p>
      </Card>

      <Card className="divide-y">
        {tokens.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No tokens yet.</p>}
        {tokens.map((t) => (
          <div key={t.id} className="flex items-center justify-between p-3">
            <div>
              <p className="text-sm font-medium">{t.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{t.prefix}… · created {new Date(t.createdAt).toLocaleDateString('en-IN')}{t.lastUsedAt ? ` · last used ${new Date(t.lastUsedAt).toLocaleDateString('en-IN')}` : ' · never used'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={t.revoked ? 'destructive' : 'success'}>{t.revoked ? 'Revoked' : 'Active'}</Badge>
              {!t.revoked && <Button size="sm" variant="ghost" disabled={pending} onClick={() => revoke(t.id)}><Ban className="h-4 w-4" /> Revoke</Button>}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

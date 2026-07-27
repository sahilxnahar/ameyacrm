import type { Metadata } from 'next';
import Link from 'next/link';
import { Plug, ArrowRight, CheckCircle2, Info, PlugZap } from 'lucide-react';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CONNECTORS } from '@/config/connectors';
import { connectorInstalls } from '@/server/actions/connectors';

export const metadata: Metadata = { title: 'My apps' };
export const dynamic = 'force-dynamic';

// Connectors that actually move data end-to-end today (the rest authorise only).
const FULLY_WORKING = new Set(['slack', 'discord', 'telegram', 'razorpay', 'whatsapp-business']);

export default async function AppsPage() {
  await requirePermission('admin.setting.manage');
  const installs = await connectorInstalls();
  const installedSlugs = Object.keys(installs);
  const installed = CONNECTORS.filter((c) => installedSlugs.includes(c.slug));

  return (
    <div className="space-y-6">
      <PageHeader title="My apps" description="The apps you've installed, and what each one does today." />

      <Card className="flex items-start gap-3 border-primary/30 bg-primary/5 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="text-sm">
          <p className="font-medium">What “installed” means, honestly.</p>
          <p className="mt-1 text-muted-foreground">
            Installing an app authorises the connection. A few work end-to-end today — <strong>Slack, Discord and Telegram</strong> (messaging), <strong>Razorpay</strong> (payment reconciliation) and the <strong>property-portal</strong> lead feeds. Others (Gmail, Google, HubSpot and so on) currently store the connection; their deeper two-way sync is being rolled out one app at a time.
          </p>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Installed ({installed.length})</h2>
        <Link href="/app-exchange"><Button size="sm" variant="outline"><Plug className="h-4 w-4" /> Browse the App Exchange</Button></Link>
      </div>

      {installed.length === 0 ? (
        <Card className="p-10 text-center">
          <PlugZap className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No apps installed yet</p>
          <p className="text-xs text-muted-foreground">Open the App Exchange to connect the tools you use.</p>
          <Link href="/app-exchange" className="mt-3 inline-block"><Button size="sm"><Plug className="h-4 w-4" /> Browse the App Exchange</Button></Link>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {installed.map((c) => {
            const state = installs[c.slug];
            const disabled = state?.status === 'DISABLED';
            const working = FULLY_WORKING.has(c.slug);
            return (
              <Link key={c.slug} href="/app-exchange">
                <Card interactive className="flex h-full flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{c.name}</p>
                    {disabled
                      ? <Badge variant="outline">Disabled</Badge>
                      : working
                        ? <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" />Working</Badge>
                        : <Badge variant="secondary">Connected</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{c.category}</p>
                  <p className="text-xs text-muted-foreground">
                    {working ? 'Live and moving data.' : 'Authorised. Deeper sync is rolling out.'}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary">Manage <ArrowRight className="h-3.5 w-3.5" /></span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, CircleDashed, CircleOff, AlertTriangle, ExternalLink } from 'lucide-react';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getIntegrations, type Health } from '@/server/services/integrations-service';

export const metadata: Metadata = { title: 'Integrations' };
export const dynamic = 'force-dynamic';

const STATE: Record<Health, { icon: typeof CheckCircle2; label: string; tone: 'success' | 'secondary' | 'warning' | 'destructive' }> = {
  live:       { icon: CheckCircle2,  label: 'Working',      tone: 'success' },
  configured: { icon: CircleDashed,  label: 'Ready, unused', tone: 'secondary' },
  off:        { icon: CircleOff,     label: 'Not set up',    tone: 'warning' },
  broken:     { icon: AlertTriangle, label: 'Needs fixing',  tone: 'destructive' },
};

export default async function IntegrationsPage() {
  await requirePermission('admin.setting.manage');
  const items = await getIntegrations();
  const counts = { live: 0, configured: 0, off: 0, broken: 0 } as Record<Health, number>;
  items.forEach((i) => counts[i.health]++);
  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <div>
      <PageHeader
        title="Integrations"
        description="Everything this CRM can connect to, whether it is switched on, and whether it is actually working."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {(Object.keys(STATE) as Health[]).map((h) => {
          const S = STATE[h];
          return (
            <Card key={h} className="p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><S.icon className="h-3.5 w-3.5" /> {S.label}</p>
              <p className="font-display text-2xl font-semibold tabular">{counts[h]}</p>
            </Card>
          );
        })}
      </div>

      <div className="space-y-5">
        {categories.map((cat) => (
          <div key={cat}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{cat}</p>
            <div className="grid gap-2 lg:grid-cols-2">
              {items.filter((i) => i.category === cat).map((i) => {
                const S = STATE[i.health];
                return (
                  <Card key={i.key} className="lift p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{i.name}</p>
                      <Badge variant={S.tone} className="shrink-0 gap-1"><S.icon className="h-3 w-3" /> {S.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{i.what}</p>
                    <p className="mt-2 text-xs"><span className="text-muted-foreground">Status:</span> {i.detail}</p>
                    <p className="text-xs"><span className="text-muted-foreground">Cost:</span> {i.needs}</p>
                    {i.docs && <p className="text-xs text-muted-foreground">{i.docs}</p>}
                    {i.setupHref && (
                      <Link href={i.setupHref} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                        Open <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Card className="mt-5 p-4 text-sm">
        <p className="font-medium">Why there is no app marketplace here</p>
        <p className="mt-1 text-muted-foreground">
          Zoho and Salesforce have hundreds of third-party apps because thousands of companies use them.
          This CRM is yours alone, so a marketplace would have nothing in it. What a marketplace actually
          gives you — a way to plug in other systems — is covered by the public API and the webhooks above.
          Anything you need connecting, ask and it gets built directly.
        </p>
      </Card>
    </div>
  );
}

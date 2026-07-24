import type { Metadata } from 'next';
import { formatDistanceToNow } from 'date-fns';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'Errors' };
export const dynamic = 'force-dynamic';

export default async function ErrorsPage() {
  await requirePermission('admin.setting.manage');
  const errors = await prisma.errorLog.findMany({ orderBy: { lastSeenAt: 'desc' }, take: 100 });
  const open = errors.filter((e) => !e.resolvedAt);

  return (
    <div>
      <PageHeader
        title="Errors"
        description="Every crash the CRM has hit, grouped and counted. Admins are emailed the first time each new one appears."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-3"><p className="text-xs text-muted-foreground">Unresolved</p><p className="font-display text-2xl font-semibold">{open.length}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Total occurrences</p><p className="font-display text-2xl font-semibold">{errors.reduce((n, e) => n + e.count, 0)}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Last 24h</p><p className="font-display text-2xl font-semibold">{errors.filter((e) => Date.now() - e.lastSeenAt.getTime() < 86400000).length}</p></Card>
      </div>

      {errors.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nothing has gone wrong yet. That is the result you want here.
        </Card>
      ) : (
        <div className="space-y-2">
          {errors.map((e) => (
            <Card key={e.id} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{e.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {[e.path, `seen ${e.count}×`, `last ${formatDistanceToNow(e.lastSeenAt, { addSuffix: true })}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Badge variant={e.resolvedAt ? 'success' : e.count > 5 ? 'destructive' : 'warning'}>
                  {e.resolvedAt ? 'resolved' : e.count > 5 ? 'recurring' : 'open'}
                </Badge>
              </div>
              {e.stack && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">Show technical detail</summary>
                  <pre className="mt-1 max-h-56 overflow-auto rounded bg-secondary p-2 text-[10px] leading-relaxed">{e.stack}</pre>
                </details>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

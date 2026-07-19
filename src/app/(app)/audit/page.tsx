import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime, titleCase } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Audit Trail' };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  await requirePermission('audit.view');
  const { action } = await searchParams;
  const logs = await prisma.auditLog.findMany({
    where: action ? { action: action as never } : undefined,
    orderBy: { createdAt: 'desc' }, take: 200, include: { actor: { select: { name: true } } },
  });
  const actions = ['LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'UPLOAD', 'DOWNLOAD', 'PASSWORD_CHANGE', 'ROLE_CHANGE'];

  return (
    <div>
      <PageHeader title="Audit Trail" description="Every sensitive action, immutably logged.">
        <Button asChild variant="outline" size="sm"><a href="/api/reports/audit.csv">Export CSV</a></Button>
      </PageHeader>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button asChild variant={!action ? 'secondary' : 'ghost'} size="sm"><a href="/audit">All</a></Button>
        {actions.map((a) => <Button key={a} asChild variant={action === a ? 'secondary' : 'ghost'} size="sm"><a href={`/audit?action=${a}`}>{titleCase(a)}</a></Button>)}
      </div>
      <Card><Table>
        <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Summary</TableHead><TableHead>IP</TableHead></TableRow></TableHeader>
        <TableBody>
          {logs.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No audit entries.</TableCell></TableRow>}
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(l.createdAt)}</TableCell>
              <TableCell className="text-sm">{l.actor?.name ?? 'System'}</TableCell>
              <TableCell><Badge variant="outline">{titleCase(l.action)}</Badge></TableCell>
              <TableCell className="text-sm text-muted-foreground">{l.entityType ?? '—'}</TableCell>
              <TableCell className="max-w-xs truncate text-sm">{l.summary ?? '—'}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{l.ipAddress ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></Card>
    </div>
  );
}

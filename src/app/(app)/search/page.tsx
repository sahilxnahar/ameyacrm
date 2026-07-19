import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth/current-user';
import { globalSearch } from '@/server/services/search-service';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export const metadata: Metadata = { title: 'Search' };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAuth();
  const { q } = await searchParams;
  const results = q ? await globalSearch(q) : [];
  return (
    <div>
      <PageHeader title="Search" description="Find tasks, leads, documents, people and requests." />
      <form className="mb-6 max-w-xl"><Input name="q" defaultValue={q ?? ''} placeholder="Search everything…" autoFocus /></form>
      {q && <p className="mb-3 text-sm text-muted-foreground">{results.length} result(s) for “{q}”.</p>}
      <div className="space-y-2">
        {results.map((r) => (
          <Link key={`${r.type}-${r.id}`} href={r.href}>
            <Card className="flex items-center gap-3 p-3 transition-colors hover:border-primary hover:bg-secondary/40">
              <Badge variant="secondary">{r.type}</Badge>
              <div className="min-w-0"><p className="truncate font-medium">{r.title}</p><p className="truncate text-xs text-muted-foreground">{r.subtitle}</p></div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

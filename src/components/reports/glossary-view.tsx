'use client';
import * as React from 'react';
import { Search } from 'lucide-react';
import { GLOSSARY } from '@/config/glossary';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

/** A searchable plain-English dictionary of every term the CRM uses. */
export function GlossaryView() {
  const [q, setQ] = React.useState('');
  const term = q.trim().toLowerCase();
  const list = term
    ? GLOSSARY.filter((t) =>
        t.term.toLowerCase().includes(term) ||
        t.plain.toLowerCase().includes(term) ||
        (t.where ?? '').toLowerCase().includes(term) ||
        (t.aka ?? []).some((a) => a.toLowerCase().includes(term)),
      )
    : GLOSSARY;
  const sorted = [...list].sort((a, b) => a.term.localeCompare(b.term));

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a term — e.g. escrow, UTR, GRN…" className="pl-9" />
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No term matches “{q}”. Try a shorter word.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((t) => (
            <Card key={t.id} id={t.id} className="scroll-mt-24 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-base font-semibold">{t.term}</h3>
                {t.where && <span className="shrink-0 text-[11px] text-muted-foreground">{t.where}</span>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t.plain}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

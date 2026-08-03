'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Users2, Building2, ListTodo, BookOpen } from 'lucide-react';
import type { SandboxData } from '@/server/services/sandbox-service';
import { Kpi, PageHead, ResetButton, crore, inr } from './demo-shared';

/** The demo's home screen: the same shape as the real dashboard, sandbox data. */
export function DemoOverview({ data, name }: { data: SandboxData; name: string }) {
  const expires = React.useMemo(() => {
    const ms = new Date(data.expiresAt).getTime() - Date.now();
    if (ms <= 0) return 'shortly';
    const h = Math.floor(ms / 3600_000);
    return h >= 1 ? `in about ${h} hour${h === 1 ? '' : 's'}` : 'in under an hour';
  }, [data.expiresAt]);

  const openTasks = data.tasks.filter((t) => !t.done).length;
  const booked = data.units.filter((u) => u.status === 'BOOKED').length;

  const CARDS = [
    { href: '/demo/sales', label: 'Sales', Icon: Users2, line: `${data.leads.length} leads in play`, blurb: 'Add an enquiry and move it through to a booking.' },
    { href: '/demo/inventory', label: 'Inventory', Icon: Building2, line: `${data.totals.available} of ${data.totals.units} flats free`, blurb: 'Hold a flat for a buyer, or mark one booked.' },
    { href: '/demo/tasks', label: 'Tasks', Icon: ListTodo, line: `${openTasks} still open`, blurb: 'Your follow-ups and site visits.' },
    { href: '/demo/tally', label: 'Ameya Tally', Icon: BookOpen, line: `${data.entries.length} entries posted`, blurb: 'Post a double-entry journal and watch it balance.' },
  ];

  return (
    <div>
      <PageHead
        title={`Welcome, ${name.split(' ')[0]}`}
        blurb={`This is your own demo workspace — real features, invented data. It resets ${expires}.`}
      >
        <ResetButton />
      </PageHead>

      <div className="stat-grid">
        <Kpi label="Leads in play" value={String(data.leads.length)} hint={`${data.leads.filter((l) => l.status === 'BOOKED').length} booked`} />
        <Kpi label="Flats available" value={`${data.totals.available} / ${data.totals.units}`} hint={`${booked} booked`} />
        <Kpi label="Pipeline value" value={crore(data.totals.pipelineValue)} hint="Sum of lead budgets" />
        <Kpi label="Received to bank" value={crore(data.totals.collected)} hint="From the demo books" />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Try it out</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map(({ href, label, Icon, line, blurb }) => (
          <Link key={href} href={href} className="focus-ring card-elevated group rounded-lg border bg-background p-4 transition-colors hover:bg-secondary/40">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <p className="font-medium">{label}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-1.5 text-sm">{line}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{blurb}</p>
          </Link>
        ))}
      </div>

      {data.entries.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent activity</h2>
          <ul className="divide-y rounded-lg border">
            {data.entries.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 p-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{e.narration}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{e.date}</span>
                <span className="shrink-0 font-medium">{inr(e.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

'use client';
import * as React from 'react';
import { LayoutList, Columns3 } from 'lucide-react';
import { SalesPipeline } from './sales-pipeline';
import { LeadBoard, type BoardLead } from './lead-board';
import { cn } from '@/lib/utils/cn';

const KEY = 'amh:sales-view';

/**
 * Two ways of looking at the same leads: the list, and the board.
 *
 * Deliberately one dataset behind both. A separate "prospects" table alongside
 * leads is how a CRM ends up with the sales team working from one and every
 * report built on the other; a lead's stage is one field, and a board is just a
 * different arrangement of that field.
 *
 * The choice is remembered per device, because which one you want depends on
 * what you are doing — the list to search and filter, the board to see where
 * everything has got stuck.
 */
export function SalesViews({ leads, users, projects, board, canMove }: {
  leads: React.ComponentProps<typeof SalesPipeline>['leads'];
  users: React.ComponentProps<typeof SalesPipeline>['users'];
  projects: React.ComponentProps<typeof SalesPipeline>['projects'];
  board: BoardLead[];
  canMove: boolean;
}) {
  const [view, setView] = React.useState<'list' | 'board'>('list');
  React.useEffect(() => {
    try { if (localStorage.getItem(KEY) === 'board') setView('board'); } catch { /* ignore */ }
  }, []);
  const pick = (v: 'list' | 'board') => {
    setView(v);
    try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
  };

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border p-0.5">
        {([['list', 'List', LayoutList], ['board', 'Board', Columns3]] as const).map(([v, label, Icon]) => (
          <button
            key={v} type="button" onClick={() => pick(v)}
            aria-pressed={view === v}
            className={cn('focus-ring inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
              view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary')}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {view === 'board'
        ? <LeadBoard leads={board} canMove={canMove} />
        : <SalesPipeline leads={leads} users={users} projects={projects} />}
    </div>
  );
}

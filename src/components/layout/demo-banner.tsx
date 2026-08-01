'use client';

import * as React from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Always-on reminder that this is the demo.
 *
 * Deliberately not dismissible. Someone exploring a CRM full of plausible
 * numbers must never be in doubt about whether what they are looking at is
 * real — a banner you can close is a banner that gets closed and forgotten.
 */
export function DemoBanner() {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-center text-xs text-amber-900 dark:text-amber-200 print:hidden"
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0" />
      <span>
        <strong className="font-semibold">Demo workspace</strong> — everything here is sample data in your own private
        sandbox. Nothing you do affects real company records.
      </span>
    </div>
  );
}

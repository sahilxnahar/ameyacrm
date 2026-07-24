'use client';

import { X, Loader2 } from 'lucide-react';

/**
 * The strip that appears once rows are ticked.
 *
 * Fixed to the bottom above the mobile nav, because on a phone the selection
 * usually happens further down a long list than the top of the screen.
 */
export function BulkBar({
  count, onClear, busy, children,
}: {
  count: number;
  onClear: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 mx-auto w-[min(100%-1rem,64rem)] lg:bottom-4">
      <div className="card-elevated flex flex-wrap items-center gap-2 border-primary/40 bg-card p-2.5 shadow-lg">
        <span className="ml-1 text-sm font-medium">
          {count} selected
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <button
          type="button" onClick={onClear} aria-label="Clear the selection"
          className="focus-ring rounded-md border p-1.5 hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** A tick box sized for a finger, for use in list rows. */
export function RowCheck({
  checked, onChange, label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.checked)}
      className="focus-ring h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
    />
  );
}

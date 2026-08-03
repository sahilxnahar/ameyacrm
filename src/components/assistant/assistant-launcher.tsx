'use client';
import * as React from 'react';
import { Sparkles, X } from 'lucide-react';
import { AssistantChat } from './assistant-chat';

/**
 * The AI Assistant, one tap away from every screen. A floating button in the
 * bottom-right opens a chat panel that sits over the page — no navigating away.
 */
export function AssistantLauncher() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open the AI assistant"
          title="AI assistant"
          /* Smaller and quieter on a laptop.
             At 14 × 14 this sat over the right-hand column of any two-column
             screen — on a 13" display the page content runs to within 30px of
             where the button is pinned, so it covered a checkbox on the TDS
             calculator and the last figure of the ledger summary. Shrinking it
             on desktop and letting it rest at 70% until you point at it keeps
             it available without it sitting on top of the work. */
          className="focus-ring fixed right-4 z-sticky flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-100 shadow-lg transition-[transform,opacity] hover:opacity-100 focus-visible:opacity-100 active:scale-95 lg:right-6 lg:h-12 lg:w-12 lg:opacity-70"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-dock bg-black/40 sm:bg-transparent" onClick={() => setOpen(false)} aria-hidden />
          <div
            className="fixed inset-x-0 bottom-0 z-popover flex h-[85vh] flex-col rounded-t-2xl border-t bg-card p-3 shadow-2xl sm:inset-x-auto sm:right-6 sm:h-[70vh] sm:w-[400px] sm:rounded-2xl sm:border"
            style={{ bottom: 'env(safe-area-inset-bottom)' }}
            role="dialog"
            aria-label="AI assistant"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-brass" /> Assistant</p>
              <button onClick={() => setOpen(false)} aria-label="Close" className="focus-ring rounded-md p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AssistantChat configured />
            </div>
          </div>
        </>
      )}
    </>
  );
}

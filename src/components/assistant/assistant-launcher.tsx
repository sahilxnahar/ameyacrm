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
          className="focus-ring fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 lg:right-6"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 sm:bg-transparent" onClick={() => setOpen(false)} aria-hidden />
          <div
            className="fixed inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col rounded-t-2xl border-t bg-card p-3 shadow-2xl sm:inset-x-auto sm:right-6 sm:h-[70vh] sm:w-[400px] sm:rounded-2xl sm:border"
            style={{ bottom: 'env(safe-area-inset-bottom)' }}
            role="dialog"
            aria-label="AI assistant"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-[#A07D34]" /> Assistant</p>
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

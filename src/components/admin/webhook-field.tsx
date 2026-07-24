'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';

/**
 * A read-only, copy-able webhook URL plus the plain steps to switch a channel
 * on. This is the piece that turns a "built but idle" integration into a live
 * one — the operator pastes the URL into Exotel/Meta/Apps Script and follows
 * the numbered steps.
 */
export function WebhookField({ url, note, steps }: { url: string; note?: string; steps?: string[] }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Webhook URL copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy — select the text and copy it manually.');
    }
  };
  return (
    <div className="mt-2 space-y-2 rounded-md border border-dashed border-input bg-secondary/30 p-2">
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-background px-2 py-1 text-[11px]">{url}</code>
        <button
          type="button"
          onClick={copy}
          className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-secondary"
          aria-label="Copy webhook URL"
        >
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      {steps && steps.length > 0 && (
        <ol className="list-decimal space-y-0.5 pl-4 text-[11px] text-muted-foreground">
          {steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      )}
    </div>
  );
}

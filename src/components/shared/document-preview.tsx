'use client';
import * as React from 'react';
import { FileText, ExternalLink, Download, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * <DocumentPreview /> — one reusable inline viewer so an uploaded or linked file
 * "opens up right there" instead of only offering a download link. Used next to
 * every uploader and import surface in Ameya OS.
 *
 *  - Images (jpeg/png/webp/gif/svg): rendered inline; click opens the full file.
 *  - PDFs: embedded with <object> (native browser viewer), with a graceful
 *    "open in new tab" fallback for browsers/mobile that won't inline a PDF.
 *  - Anything else: a clean file chip with open + download actions.
 *
 * Pure client, zero dependencies. Detects the kind from the MIME type first,
 * then the file extension, so it works even when the caller doesn't know the MIME.
 */
export interface DocumentPreviewProps {
  url: string;
  name?: string;
  mime?: string | null;
  /** Tailwind max-height class for the inline frame. Default h-64. */
  heightClass?: string;
  className?: string;
}

type Kind = 'image' | 'pdf' | 'other';

function detectKind(mime?: string | null, url?: string, name?: string): Kind {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf') return 'pdf';
  const src = `${name ?? ''} ${url ?? ''}`.toLowerCase();
  const ext = src.split(/[?#]/)[0]?.match(/\.([a-z0-9]+)\s*$/)?.[1] ?? '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'avif'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'other';
}

function fileLabel(name?: string, url?: string): string {
  if (name) return name;
  try { return decodeURIComponent((url ?? '').split('/').pop()?.split(/[?#]/)[0] ?? 'file'); }
  catch { return 'file'; }
}

export function DocumentPreview({ url, name, mime, heightClass = 'h-64', className }: DocumentPreviewProps) {
  const [imgError, setImgError] = React.useState(false);
  const kind = detectKind(mime, url, name);
  const label = fileLabel(name, url);

  return (
    <div className={cn('overflow-hidden rounded-lg border bg-muted/20', className)}>
      {/* Header strip — name + open/download, always available whatever the kind. */}
      <div className="flex items-center justify-between gap-2 border-b bg-background/60 px-3 py-1.5">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate" title={label}>{label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <a href={url} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" title="Open in new tab">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a href={url} download={label} className="focus-ring inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" title="Download">
            <Download className="h-3.5 w-3.5" />
          </a>
        </span>
      </div>

      {kind === 'image' && !imgError ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className={cn('flex items-center justify-center bg-[repeating-conic-gradient(#0000_0deg_90deg,#8881_90deg_180deg)] bg-[length:16px_16px]', heightClass)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} onError={() => setImgError(true)} className="max-h-full max-w-full object-contain" />
        </a>
      ) : kind === 'pdf' ? (
        <object data={url} type="application/pdf" className={cn('w-full', heightClass)}>
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <FileText className="h-6 w-6" />
            <span>Preview isn’t available inline here.</span>
            <a href={url} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
              <ExternalLink className="h-3.5 w-3.5" /> Open the PDF
            </a>
          </div>
        </object>
      ) : (
        <div className={cn('flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground', heightClass)}>
          {imgError ? <ImageOff className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
          <span>{imgError ? 'That image could not be shown.' : 'No inline preview for this file type.'}</span>
          <a href={url} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
            <ExternalLink className="h-3.5 w-3.5" /> Open the file
          </a>
        </div>
      )}
    </div>
  );
}

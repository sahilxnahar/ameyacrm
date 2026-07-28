'use client';
import * as React from 'react';
import { upload } from '@vercel/blob/client';
import { toast } from 'sonner';
import { UploadCloud, Loader2, FileCheck2, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { DocumentPreview } from './document-preview';

/**
 * <UniversalUploader /> — one reusable client uploader used everywhere a file is
 * dropped into Ameya OS (the Due Diligence vault, and beyond). It uploads directly
 * to blob storage (no 4.5 MB serverless cap), so it stays a pure client component
 * and hands the resulting public URL back to the caller, who persists it via a
 * server action.
 *
 * Behaviour:
 *  - Desktop: drag & drop with a hover state and no layout shift; click to browse.
 *  - Mobile:  the file input carries `capture` so iOS/Android offer camera or
 *             photo-library directly; a bad capture just no-ops, never crashes.
 *  - Validation: strict MIME allow-list (PDF/JPEG/PNG by default), size cap, and
 *             duplicate detection against names already uploaded this session.
 *  - Feedback: clean toasts; the tile shows uploading / uploaded / idle states.
 */
export interface UniversalUploaderProps {
  onUploaded: (file: { url: string; name: string; mime: string; size: number }) => void;
  accept?: string;                 // input accept attr
  allowedMime?: string[];          // strict allow-list
  maxBytes?: number;
  autoActivate?: boolean;          // open the file picker on mount (URL-intent driven)
  compact?: boolean;
  className?: string;
  label?: string;
  hint?: string;
  preview?: boolean;               // show an inline preview of the uploaded file (default: true)
  previewHeightClass?: string;     // Tailwind max-height for the preview frame
}

const DEFAULT_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const DEFAULT_ACCEPT = 'application/pdf,image/jpeg,image/png';
const DEFAULT_MAX = 50 * 1024 * 1024; // 50 MB

function humanSize(n: number): string {
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let v = n;
  while (v >= 1024 && i < 3) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

export function UniversalUploader({
  onUploaded,
  accept = DEFAULT_ACCEPT,
  allowedMime = DEFAULT_MIME,
  maxBytes = DEFAULT_MAX,
  autoActivate = false,
  compact = false,
  className,
  label = 'Drag a PDF or photo here',
  hint = 'or tap to choose / photograph — PDF, JPEG, PNG',
  preview = true,
  previewHeightClass,
}: UniversalUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const seen = React.useRef<Set<string>>(new Set());
  const [over, setOver] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const [last, setLast] = React.useState<{ url: string; name: string; mime: string } | null>(null);

  React.useEffect(() => {
    if (autoActivate) {
      // Give the dialog/accordion a beat to mount before opening the picker.
      const t = setTimeout(() => inputRef.current?.click(), 250);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [autoActivate]);

  const take = React.useCallback(async (file: File | undefined) => {
    if (!file || busy) return;
    if (allowedMime.length && !allowedMime.includes(file.type)) {
      toast.error(`Unsupported file type. Allowed: ${allowedMime.map((m) => m.split('/')[1]).join(', ')}.`);
      return;
    }
    if (file.size > maxBytes) {
      toast.error(`Too large (${humanSize(file.size)}). Max ${humanSize(maxBytes)}.`);
      return;
    }
    const dupeKey = `${file.name}:${file.size}`;
    if (seen.current.has(dupeKey)) { toast.warning('That file was already uploaded here.'); return; }

    setBusy(true);
    try {
      const blob = await upload(file.name, file, { access: 'public', handleUploadUrl: '/api/upload' });
      seen.current.add(dupeKey);
      setDone(file.name);
      const mime = file.type || 'application/octet-stream';
      setLast({ url: blob.url, name: file.name, mime });
      onUploaded({ url: blob.url, name: file.name, mime, size: file.size });
      toast.success(`${file.name} uploaded`);
    } catch {
      toast.error('Upload failed — please try again.');
    } finally {
      setBusy(false);
    }
  }, [allowedMime, busy, maxBytes, onUploaded]);

  return (
    <div className="space-y-2">
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => !busy && inputRef.current?.click()}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !busy) { e.preventDefault(); inputRef.current?.click(); } }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files?.[0]); }}
      className={cn(
        'focus-ring flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-center text-sm text-muted-foreground transition-colors',
        compact ? 'min-h-[4.5rem] p-2.5' : 'min-h-[6rem] p-4',
        over ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/40 hover:bg-muted/30',
        className,
      )}
    >
      {busy ? (
        <><Loader2 className="h-5 w-5 animate-spin" /> Uploading…</>
      ) : done ? (
        <>
          <FileCheck2 className="h-5 w-5 text-emerald-500" />
          <span className="flex items-center gap-1 font-medium text-foreground">{done}<button type="button" aria-label="Clear" onClick={(e) => { e.stopPropagation(); setDone(null); }} className="rounded p-0.5 hover:bg-muted"><X className="h-3.5 w-3.5" /></button></span>
          <span className="text-xs">Drop another to replace</span>
        </>
      ) : (
        <>
          <UploadCloud className="h-5 w-5" />
          <span className="font-medium text-foreground">{label}</span>
          <span className="text-xs">{hint}</span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture="environment"
        className="hidden"
        onChange={(e) => { void take(e.target.files?.[0] ?? undefined); e.currentTarget.value = ''; }}
      />
    </div>
    {preview && last ? (
      <DocumentPreview url={last.url} name={last.name} mime={last.mime} heightClass={previewHeightClass ?? (compact ? 'h-40' : 'h-64')} />
    ) : null}
    </div>
  );
}

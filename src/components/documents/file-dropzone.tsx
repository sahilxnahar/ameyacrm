'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { toast } from 'sonner';
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, File as FileIcon, RotateCcw, ClipboardPaste } from 'lucide-react';
import { registerUploadedDocument } from '@/server/actions/documents';

type Status = 'queued' | 'uploading' | 'done' | 'error';
interface Item { name: string; size: number; status: Status; error?: string; progress?: number; preview?: string }

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB, matches the copy
const bytes = (n: number) => { const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let v = n; while (v >= 1024 && i < 3) { v /= 1024; i++; } return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`; };
const isImage = (f: File) => f.type.startsWith('image/');

function relativeFolder(file: File): string[] {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
  if (!rel) return [];
  const parts = rel.split('/'); parts.pop();
  return parts.filter(Boolean).slice(0, 6);
}

/**
 * Drag & drop (from the desktop), tap-to-choose, whole-folder, and now
 * paste-from-clipboard (a screenshot or copied file) uploader — straight to blob
 * storage, so no 4.5 MB limit. Shows a live progress bar and a thumbnail per
 * file, validates size before it wastes an upload, and lets you retry a failure.
 */
export function FileDropzone({ folderId, onFinished }: { folderId?: string; onFinished?: () => void }) {
  const router = useRouter();
  const [items, setItems] = React.useState<Item[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [justPasted, setJustPasted] = React.useState(false);
  const folderRef = React.useRef<HTMLInputElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const filesRef = React.useRef<File[]>([]); // keep the File objects for retry
  const previewsRef = React.useRef<string[]>([]); // object URLs to revoke on unmount

  React.useEffect(() => () => { previewsRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const patch = (i: number, p: Partial<Item>) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...p } : it)));

  const uploadOne = async (file: File, i: number) => {
    if (file.size > MAX_BYTES) { patch(i, { status: 'error', error: `Too big (${bytes(file.size)}). Max 100 MB.` }); return false; }
    patch(i, { status: 'uploading', progress: 0 });
    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        onUploadProgress: (e: { percentage: number }) => patch(i, { progress: Math.round(e.percentage) }),
      });
      const r = await registerUploadedDocument({
        folderId, url: blob.url, originalName: file.name,
        mimeType: file.type || 'application/octet-stream', size: file.size, subPath: relativeFolder(file),
      });
      if ('error' in r) { patch(i, { status: 'error', error: r.error }); return false; }
      patch(i, { status: 'done', progress: 100 });
      if (r.fileId) {
        void fetch('/api/documents/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId: r.fileId }), keepalive: true }).catch(() => undefined);
      }
      return true;
    } catch (e) {
      patch(i, { status: 'error', error: e instanceof Error ? e.message : 'Upload failed' });
      return false;
    }
  };

  const run = async (files: File[]) => {
    if (!files.length || busy) return;
    filesRef.current = files;
    const previews = files.map((f) => (isImage(f) ? URL.createObjectURL(f) : undefined));
    previewsRef.current.push(...previews.filter((u): u is string => Boolean(u)));
    setItems(files.map((f, idx) => ({ name: f.name, size: f.size, status: 'queued', preview: previews[idx] })));
    setBusy(true);
    let ok = 0, fail = 0;
    for (const [i, file] of files.entries()) { if (await uploadOne(file, i)) ok++; else fail++; }
    setBusy(false);
    if (ok) toast.success(`${ok} file${ok > 1 ? 's' : ''} uploaded`);
    if (fail) toast.error(`${fail} file${fail > 1 ? 's' : ''} failed`);
    router.refresh();
    if (!fail) onFinished?.();
  };

  const retry = async (i: number) => {
    const file = filesRef.current[i];
    if (!file || busy) return;
    setBusy(true);
    const okThis = await uploadOne(file, i);
    setBusy(false);
    if (okThis) { toast.success('Uploaded'); router.refresh(); }
  };

  // Paste a screenshot or a copied file straight in — "from anywhere else".
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length === 0) return;
      e.preventDefault();
      setJustPasted(true); window.setTimeout(() => setJustPasted(false), 1200);
      void run(files);
    };
    const el = rootRef.current;
    el?.addEventListener('paste', onPaste as EventListener);
    return () => el?.removeEventListener('paste', onPaste as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  return (
    <div className="space-y-3" ref={rootRef} tabIndex={-1}>
      <div
        role="button" tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void run(Array.from(e.dataTransfer.files)); }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.click(); }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/60 hover:bg-secondary/40'}`}
      >
        <UploadCloud className={`mb-2 h-8 w-8 text-primary transition-transform ${dragging ? 'scale-110' : ''}`} />
        <p className="text-sm font-medium">Drag &amp; drop files here</p>
        <p className="mt-0.5 text-xs text-muted-foreground">or tap to choose, paste a screenshot, or drop a whole folder — any type, up to 100 MB each</p>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => { void run(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
        <input
          ref={folderRef} type="file" multiple className="hidden"
          // @ts-expect-error — non-standard, but supported by every browser that matters
          webkitdirectory="" directory=""
          onChange={(e) => { void run(Array.from(e.target.files ?? [])); e.target.value = ''; }}
        />
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={(e) => { e.stopPropagation(); folderRef.current?.click(); }} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-secondary">Choose a folder</button>
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors ${justPasted ? 'bg-primary/15 text-primary' : ''}`}><ClipboardPaste className="h-3 w-3" /> Paste works too</span>
        </div>
      </div>

      {items.length > 0 && (
        <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-md border p-2">
          {items.map((it, i) => (
            <div key={`${it.name}-${i}`} className="flex items-center gap-2.5 text-xs">
              {it.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.preview} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-secondary">
                  {it.status === 'done' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    : it.status === 'error' ? <AlertCircle className="h-4 w-4 text-destructive" />
                    : it.status === 'uploading' ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    : <FileIcon className="h-4 w-4 text-muted-foreground" />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{it.name}</span>
                  <span className={`shrink-0 ${it.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {it.status === 'error' ? (it.error ?? 'failed') : it.status === 'uploading' ? `${it.progress ?? 0}%` : it.status === 'done' ? 'done' : bytes(it.size)}
                  </span>
                </div>
                {(it.status === 'uploading' || it.status === 'done') && (
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${it.status === 'done' ? 100 : it.progress ?? 0}%` }} />
                  </div>
                )}
              </div>
              {it.status === 'error' && (
                <button type="button" onClick={() => void retry(i)} disabled={busy} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Try again">
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {busy && <p className="text-xs text-muted-foreground">Uploading… keep this open until it finishes.</p>}
    </div>
  );
}

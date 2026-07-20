'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { toast } from 'sonner';
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, File as FileIcon } from 'lucide-react';
import { registerUploadedDocument } from '@/server/actions/documents';

type Status = 'queued' | 'uploading' | 'done' | 'error';
interface Item { name: string; size: number; status: Status; error?: string }
const bytes = (n: number) => { const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let v = n; while (v >= 1024 && i < 3) { v /= 1024; i++; } return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`; };

/** Drag & drop (or tap on mobile) bulk uploader. Uploads straight to blob storage — no 4.5 MB limit. */
/** The folders a file came from when a whole directory is dropped or chosen. */
function relativeFolder(file: File): string[] {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
  if (!rel) return [];
  const parts = rel.split('/');
  parts.pop();
  return parts.filter(Boolean).slice(0, 6);
}

export function FileDropzone({ folderId, onFinished }: { folderId?: string; onFinished?: () => void }) {
  const router = useRouter();
  const [items, setItems] = React.useState<Item[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const folderRef = React.useRef<HTMLInputElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const run = async (files: File[]) => {
    if (!files.length || busy) return;
    const next: Item[] = files.map((f) => ({ name: f.name, size: f.size, status: 'queued' }));
    setItems([...next]); setBusy(true);
    let ok = 0, fail = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      next[i] = { ...next[i], status: 'uploading' }; setItems([...next]);
      try {
        const blob = await upload(file.name, file, { access: 'public', handleUploadUrl: '/api/upload' });
        const rel = relativeFolder(file);
        const r = await registerUploadedDocument({
          folderId, url: blob.url, originalName: file.name,
          mimeType: file.type || 'application/octet-stream', size: file.size,
          subPath: rel,
        });
        if ('error' in r) { next[i] = { ...next[i], status: 'error', error: r.error }; fail++; }
        else {
          next[i] = { ...next[i], status: 'done' }; ok++;
          // Summarising and copying to Drive happen afterwards. Deliberately not
          // awaited — waiting for them is what made uploads feel slow.
          if (r.fileId) {
            void fetch('/api/documents/process', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileId: r.fileId }), keepalive: true,
            }).catch(() => undefined);
          }
        }
      } catch (e) {
        next[i] = { ...next[i], status: 'error', error: e instanceof Error ? e.message : 'Upload failed' }; fail++;
      }
      setItems([...next]);
    }
    setBusy(false);
    if (ok) toast.success(`${ok} file${ok > 1 ? 's' : ''} uploaded`);
    if (fail) toast.error(`${fail} file${fail > 1 ? 's' : ''} failed`);
    router.refresh();
    if (!fail) onFinished?.();
  };

  return (
    <div className="space-y-3">
      <div
        role="button" tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void run(Array.from(e.dataTransfer.files)); }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.click(); }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/60 hover:bg-secondary/40'}`}
      >
        <UploadCloud className="mb-2 h-8 w-8 text-primary" />
        <p className="text-sm font-medium">Drag &amp; drop files here</p>
        <p className="mt-0.5 text-xs text-muted-foreground">or tap to choose — any file type, whole folders included, up to 100 MB each</p>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => { void run(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
        <input
          ref={folderRef} type="file" multiple className="hidden"
          // @ts-expect-error — non-standard, but supported by every browser that matters
          webkitdirectory="" directory=""
          onChange={(e) => { void run(Array.from(e.target.files ?? [])); e.target.value = ''; }}
        />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); folderRef.current?.click(); }}
          className="mt-3 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
        >
          Or choose a whole folder
        </button>
      </div>

      {items.length > 0 && (
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
          {items.map((it, i) => (
            <div key={`${it.name}-${i}`} className="flex items-center gap-2 text-xs">
              {it.status === 'done' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                : it.status === 'error' ? <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                : it.status === 'uploading' ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                : <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className="flex-1 truncate">{it.name}</span>
              <span className={`shrink-0 ${it.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{it.status === 'error' ? (it.error ?? 'failed') : bytes(it.size)}</span>
            </div>
          ))}
        </div>
      )}
      {busy && <p className="text-xs text-muted-foreground">Uploading… keep this dialog open.</p>}
    </div>
  );
}

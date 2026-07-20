'use client';
import * as React from 'react';
import { format } from 'date-fns';
import {
  FileText, FileSpreadsheet, FileImage, File as FileIcon, Download,
  ExternalLink, Check, Pencil, MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface DocRow {
  id: string;
  title: string;
  fileId: string | null;
  fileName: string | null;
  mimeType: string | null;
  size: number;
  driveUrl: string | null;
  ownerName: string | null;
  updatedAt: string;
}

const iconFor = (mime: string | null) => {
  const m = mime ?? '';
  if (m.includes('sheet') || m.includes('excel') || m.includes('csv')) return FileSpreadsheet;
  if (m.startsWith('image/')) return FileImage;
  if (m.includes('pdf') || m.includes('word') || m.startsWith('text/')) return FileText;
  return FileIcon;
};

const readableSize = (n: number) =>
  n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;

/**
 * Files as a grid or a list, whichever the person prefers.
 *
 * Selection and dragging are the two things that make a file manager feel like
 * one: pick several, drag them onto a folder in the tree, done.
 */
export function FileGrid({
  documents, view, selected, onSelect, onRename, canManage,
}: {
  documents: DocRow[];
  view: 'grid' | 'list';
  selected: Set<string>;
  onSelect: (id: string, additive: boolean) => void;
  onRename?: (id: string, title: string) => void;
  canManage: boolean;
}) {
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');

  const startDrag = (e: React.DragEvent, id: string) => {
    // Dragging an unselected file drags just that one; otherwise the selection.
    const ids = selected.has(id) ? [...selected] : [id];
    e.dataTransfer.setData('text/plain', JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'move';
  };

  const commit = (id: string) => {
    const v = draft.trim();
    setEditing(null);
    if (v) onRename?.(id, v);
  };

  if (documents.length === 0) return null;

  if (view === 'list') {
    return (
      <div className="table-scroll">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="w-8 p-2" /><th className="p-2">Name</th><th className="p-2">Owner</th><th className="p-2 text-right">Size</th><th className="p-2">Changed</th><th className="p-2" /></tr>
          </thead>
          <tbody>
            {documents.map((d) => {
              const Icon = iconFor(d.mimeType);
              const isSel = selected.has(d.id);
              return (
                <tr
                  key={d.id}
                  draggable
                  onDragStart={(e) => startDrag(e, d.id)}
                  onClick={(e) => onSelect(d.id, e.metaKey || e.ctrlKey || e.shiftKey)}
                  className={cn('cursor-pointer border-b last:border-0', isSel ? 'bg-primary/10' : 'hover:bg-secondary/50')}
                >
                  <td className="p-2">
                    <span className={cn('flex h-4 w-4 items-center justify-center rounded border', isSel && 'border-primary bg-primary text-white')}>
                      {isSel && <Check className="h-3 w-3" />}
                    </span>
                  </td>
                  <td className="p-2">
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {editing === d.id ? (
                        <input
                          autoFocus value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => commit(d.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') commit(d.id); if (e.key === 'Escape') setEditing(null); }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-7 w-full rounded border border-input bg-background px-1.5 text-sm"
                        />
                      ) : (
                        <span className="truncate font-medium">{d.title}</span>
                      )}
                    </span>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">{d.ownerName ?? '—'}</td>
                  <td className="p-2 text-right text-xs text-muted-foreground tabular">{d.size ? readableSize(d.size) : '—'}</td>
                  <td className="p-2 text-xs text-muted-foreground">{format(new Date(d.updatedAt), 'd MMM')}</td>
                  <td className="p-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <span className="flex justify-end gap-1">
                      {canManage && (
                        <button className="rounded p-1 hover:bg-secondary" title="Rename"
                          onClick={() => { setEditing(d.id); setDraft(d.title); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {d.fileId && (
                        <a className="rounded p-1 hover:bg-secondary" title="Download" href={`/api/files/${d.fileId}?download=1`}>
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {d.driveUrl && (
                        <a className="rounded p-1 hover:bg-secondary" title="Open in Drive" href={d.driveUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {documents.map((d) => {
        const Icon = iconFor(d.mimeType);
        const isSel = selected.has(d.id);
        return (
          <div
            key={d.id}
            draggable
            onDragStart={(e) => startDrag(e, d.id)}
            onClick={(e) => onSelect(d.id, e.metaKey || e.ctrlKey || e.shiftKey)}
            className={cn(
              'group relative cursor-pointer rounded-lg border p-3 transition-colors',
              isSel ? 'border-primary bg-primary/10' : 'hover:border-primary/60 hover:bg-secondary/40',
            )}
          >
            <span className={cn(
              'absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded border bg-background',
              isSel ? 'border-primary bg-primary text-white' : 'opacity-0 group-hover:opacity-100',
            )}>
              {isSel && <Check className="h-3 w-3" />}
            </span>

            <Icon className="mb-2 h-8 w-8 text-muted-foreground" />
            {editing === d.id ? (
              <input
                autoFocus value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commit(d.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') commit(d.id); if (e.key === 'Escape') setEditing(null); }}
                onClick={(e) => e.stopPropagation()}
                className="w-full rounded border border-input bg-background px-1 text-sm"
              />
            ) : (
              <p className="line-clamp-2 text-sm font-medium leading-snug">{d.title}</p>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              {[d.size ? readableSize(d.size) : null, format(new Date(d.updatedAt), 'd MMM')].filter(Boolean).join(' · ')}
            </p>

            <span className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
              {canManage && (
                <button className="rounded p-1 hover:bg-secondary" title="Rename" onClick={() => { setEditing(d.id); setDraft(d.title); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {d.fileId && <a className="rounded p-1 hover:bg-secondary" title="Download" href={`/api/files/${d.fileId}?download=1`}><Download className="h-3.5 w-3.5" /></a>}
              {d.driveUrl && <a className="rounded p-1 hover:bg-secondary" title="Open in Drive" href={d.driveUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

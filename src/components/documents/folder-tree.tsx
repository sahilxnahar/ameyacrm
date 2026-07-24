'use client';
import * as React from 'react';
import Link from 'next/link';
import { ChevronRight, Folder as FolderIcon, FolderOpen, Lock, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface TreeNode {
  id: string;
  name: string;
  parentId: string | null;
  documentCount: number;
  canOpen: boolean;
  reason?: string;
}

/**
 * The folder tree down the side.
 *
 * Locked folders stay in the tree with a padlock rather than disappearing —
 * people should know a folder exists even when they cannot read it, otherwise
 * they assume documents have been lost.
 */
export function FolderTree({
  nodes, currentId, onDropFiles,
}: {
  nodes: TreeNode[];
  currentId: string | null;
  onDropFiles?: (folderId: string) => void;
}) {
  const childrenOf = React.useMemo(() => {
    const m = new Map<string | null, TreeNode[]>();
    for (const n of nodes) m.set(n.parentId, [...(m.get(n.parentId) ?? []), n]);
    return m;
  }, [nodes]);

  // Open the path down to whatever is selected.
  const [open, setOpen] = React.useState<Set<string>>(() => {
    const s = new Set<string>();
    let id = currentId;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (let i = 0; i < 10 && id; i++) {
      s.add(id);
      id = byId.get(id)?.parentId ?? null;
    }
    return s;
  });
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);

  const toggle = (id: string) => setOpen((prev) => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const render = (parentId: string | null, depth: number): React.ReactNode =>
    (childrenOf.get(parentId) ?? []).map((n) => {
      const kids = childrenOf.get(n.id) ?? [];
      const isOpen = open.has(n.id);
      const active = currentId === n.id;

      const row = (
        <div
          onDragOver={(e) => { if (n.canOpen && onDropFiles) { e.preventDefault(); setDropTarget(n.id); } }}
          onDragLeave={() => setDropTarget((t) => (t === n.id ? null : t))}
          onDrop={(e) => { e.preventDefault(); setDropTarget(null); if (n.canOpen) onDropFiles?.(n.id); }}
          className={cn(
            'group flex items-center gap-1 rounded-md pr-2 text-sm',
            active && 'bg-primary/10 font-medium',
            dropTarget === n.id && 'ring-2 ring-primary',
            !n.canOpen && 'opacity-60',
          )}
          style={{ paddingLeft: `${depth * 12}px` }}
        >
          <button
            onClick={() => toggle(n.id)}
            className={cn('shrink-0 rounded p-1 text-muted-foreground', !kids.length && 'invisible')}
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-90')} />
          </button>

          {n.canOpen ? (
            <Link href={`/documents?folder=${n.id}`} className="flex min-h-[32px] min-w-0 flex-1 items-center gap-2 py-1">
              {isOpen ? <FolderOpen className="h-4 w-4 shrink-0 text-brass" /> : <FolderIcon className="h-4 w-4 shrink-0 text-brass" />}
              <span className="truncate">{n.name}</span>
              {n.documentCount > 0 && <span className="ml-auto shrink-0 text-[10px] text-muted-foreground tabular">{n.documentCount}</span>}
            </Link>
          ) : (
            <span className="flex min-h-[32px] min-w-0 flex-1 cursor-not-allowed items-center gap-2 py-1" title={n.reason ?? 'Restricted'}>
              <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{n.name}</span>
            </span>
          )}
        </div>
      );

      return (
        <div key={n.id}>
          {row}
          {isOpen && kids.length > 0 && render(n.id, depth + 1)}
        </div>
      );
    });

  return (
    <nav className="space-y-0.5" aria-label="Folders">
      <Link
        href="/documents"
        onDragOver={(e) => { if (onDropFiles) e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); onDropFiles?.(''); }}
        className={cn('flex min-h-[32px] items-center gap-2 rounded-md px-2 text-sm', !currentId && 'bg-primary/10 font-medium')}
      >
        <HardDrive className="h-4 w-4 shrink-0 text-brass" />
        All documents
      </Link>
      {render(null, 0)}
    </nav>
  );
}

'use client';
import * as React from 'react';
import Link from 'next/link';
import { LayoutGrid, List, ChevronRight, FolderPlus, X, FolderInput, Home } from 'lucide-react';
import { useAction } from '@/lib/hooks/use-action';
import { moveDocuments, renameDocument, createFolder } from '@/server/actions/documents';
import { FolderTree, type TreeNode } from './folder-tree';
import { FileGrid, type DocRow } from './file-grid';
import { FileDropzone } from './file-dropzone';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { FolderOpen } from 'lucide-react';

const VIEW_KEY = 'ameya.docView';

export function DriveBrowser({
  tree, documents, crumbs, currentId, canManage, canUpload,
}: {
  tree: TreeNode[];
  documents: DocRow[];
  crumbs: { id: string; name: string }[];
  currentId: string | null;
  canManage: boolean;
  canUpload: boolean;
}) {
  const { run, pending } = useAction();
  const [view, setView] = React.useState<'grid' | 'list'>('list');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [newFolder, setNewFolder] = React.useState(false);

  React.useEffect(() => {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'grid' || v === 'list') setView(v);
  }, []);
  const setViewSaved = (v: 'grid' | 'list') => { setView(v); localStorage.setItem(VIEW_KEY, v); };

  React.useEffect(() => setSelected(new Set()), [currentId]);

  const select = (id: string, additive: boolean) =>
    setSelected((prev) => {
      const n = new Set(additive ? prev : []);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const moveTo = (folderId: string) => {
    if (!folderId || !selected.size) return;
    const ids = [...selected];
    run(() => moveDocuments(ids, folderId), `${ids.length} moved`);
    setSelected(new Set());
  };

  const subfolders = tree.filter((t) => t.parentId === currentId);

  return (
    <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
      <Card className="hidden max-h-[70vh] overflow-y-auto p-2 lg:block">
        <FolderTree nodes={tree} currentId={currentId} onDropFiles={moveTo} />
      </Card>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex min-w-0 flex-1 items-center gap-1 text-sm" aria-label="Breadcrumb">
            <Link href="/documents" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <Home className="h-3.5 w-3.5" /> Documents
            </Link>
            {crumbs.map((c) => (
              <span key={c.id} className="flex min-w-0 items-center gap-1">
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                <Link href={`/documents?folder=${c.id}`} className="truncate hover:underline">{c.name}</Link>
              </span>
            ))}
          </nav>

          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setNewFolder((v) => !v)}>
              <FolderPlus className="h-4 w-4" /> New folder
            </Button>
          )}
          <span className="flex rounded-md border">
            <button onClick={() => setViewSaved('list')} title="List view"
              className={cn('rounded-l-md p-2', view === 'list' && 'bg-secondary')}><List className="h-4 w-4" /></button>
            <button onClick={() => setViewSaved('grid')} title="Grid view"
              className={cn('rounded-r-md p-2', view === 'grid' && 'bg-secondary')}><LayoutGrid className="h-4 w-4" /></button>
          </span>
        </div>

        {newFolder && canManage && (
          <Card className="p-3">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                run(() => createFolder({ name: fd.get('name'), parentId: currentId ?? undefined }), 'Folder created');
                setNewFolder(false);
              }}
            >
              <input name="name" required autoFocus placeholder="Folder name"
                className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm" />
              <Button type="submit" size="sm" disabled={pending}>Create</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setNewFolder(false)}>Cancel</Button>
            </form>
          </Card>
        )}

        {selected.size > 0 && (
          <Card className="flex flex-wrap items-center gap-2 border-primary/40 bg-primary/5 p-2.5 text-sm">
            <span className="font-medium">{selected.size} selected</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FolderInput className="h-3.5 w-3.5" /> drag onto a folder, or choose one:
            </span>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value=""
              onChange={(e) => e.target.value && moveTo(e.target.value)}
              disabled={pending}
            >
              <option value="">Move to…</option>
              {tree.filter((t) => t.canOpen && t.id !== currentId).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          </Card>
        )}

        {subfolders.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {subfolders.map((f) => (
              <FolderCard key={f.id} node={f} onDropFiles={moveTo} />
            ))}
          </div>
        )}

        {documents.length > 0 ? (
          <FileGrid
            documents={documents}
            view={view}
            selected={selected}
            onSelect={select}
            canManage={canManage}
            onRename={(id, title) => run(() => renameDocument(id, title), 'Renamed')}
          />
        ) : subfolders.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="Nothing here yet"
            body="Drop files below, or drag a whole folder from your desktop. Anything you add to Google Drive turns up here too."
          />
        ) : null}

        {canUpload && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Import files</p>
            <FileDropzone folderId={currentId ?? undefined} />
          </div>
        )}
      </div>
    </div>
  );
}

function FolderCard({ node, onDropFiles }: { node: TreeNode; onDropFiles: (id: string) => void }) {
  const [over, setOver] = React.useState(false);
  const inner = (
    <Card className={cn(
      'flex items-center gap-3 p-3 transition-colors',
      node.canOpen ? 'hover:border-primary hover:bg-secondary/40' : 'cursor-not-allowed opacity-70',
      over && 'ring-2 ring-primary',
    )}>
      <FolderOpen className={cn('h-7 w-7 shrink-0', node.canOpen ? 'text-brass' : 'text-muted-foreground')} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{node.name}</span>
        <span className="block text-xs text-muted-foreground">
          {node.canOpen ? `${node.documentCount} file${node.documentCount === 1 ? '' : 's'}` : (node.reason ?? 'Restricted')}
        </span>
      </span>
    </Card>
  );

  if (!node.canOpen) return <div title={node.reason ?? 'Restricted'}>{inner}</div>;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDropFiles(node.id); }}
    >
      <Link href={`/documents?folder=${node.id}`}>{inner}</Link>
    </div>
  );
}

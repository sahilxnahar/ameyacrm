'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { upload } from '@vercel/blob/client';
import { Upload, FolderUp, Link2, ImageIcon, FileText, FileSpreadsheet, Box, Sparkles, Download, ExternalLink, Trash2, Loader2 } from 'lucide-react';
import { addMarketingLibraryItems, addMarketingDriveLink, deleteMarketingLibraryItem } from '@/server/actions/marketing-library';
import { MARKETING_CATEGORIES, type LibraryItem } from '@/lib/marketing/library';
import type { Collateral } from '@/config/marketing-collaterals';

const KIND_ICON: Record<string, typeof FileText> = { image: ImageIcon, pdf: FileText, excel: FileSpreadsheet, doc: FileText, html: Box, link: Link2, brand: Sparkles, other: FileText };
const isViewable = (k: string) => k === 'image' || k === 'pdf' || k === 'html' || k === 'link' || k === 'brand';

export function MarketingLibrary({ featured, items, canManage }: { featured: Collateral[]; items: LibraryItem[]; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [driveTitle, setDriveTitle] = React.useState('');
  const [driveUrl, setDriveUrl] = React.useState('');
  const filesRef = React.useRef<HTMLInputElement>(null);
  const folderRef = React.useRef<HTMLInputElement>(null);

  const doUpload = async (fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;
    setBusy(`Uploading 0 / ${files.length}…`);
    try {
      const registered: Array<{ title: string; url: string; fileType?: string; sizeBytes?: number; folderPath?: string }> = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i]!;
        const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || '';
        const folderPath = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : undefined;
        setBusy(`Uploading ${i + 1} / ${files.length}…`);
        const blob = await upload(`marketing/${folderPath ? folderPath + '/' : ''}${f.name}`, f, { access: 'public', handleUploadUrl: '/api/upload' });
        registered.push({ title: f.name, url: blob.url, fileType: f.type || undefined, sizeBytes: f.size, folderPath });
      }
      setBusy('Sorting with AI…');
      const r = await addMarketingLibraryItems({ items: registered });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`Added ${r.count} file(s) — sorted into categories.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(null);
      if (filesRef.current) filesRef.current.value = '';
      if (folderRef.current) folderRef.current.value = '';
    }
  };

  const addDrive = async () => {
    if (!driveTitle.trim() || !driveUrl.trim()) { toast.error('Add a title and a link.'); return; }
    setBusy('Adding link…');
    try {
      const r = await addMarketingDriveLink({ title: driveTitle.trim(), url: driveUrl.trim() });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Drive link added.'); setDriveTitle(''); setDriveUrl(''); router.refresh();
    } finally { setBusy(null); }
  };

  const remove = async (id: string) => {
    const r = await deleteMarketingLibraryItem(id);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Removed.'); router.refresh();
  };

  const byCat = new Map<string, LibraryItem[]>();
  for (const it of items) { const a = byCat.get(it.category) ?? []; a.push(it); byCat.set(it.category, a); }
  const orderedCats = [...MARKETING_CATEGORIES].filter((c) => byCat.has(c));
  const extraCats = [...byCat.keys()].filter((c) => !(MARKETING_CATEGORIES as readonly string[]).includes(c));

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="rounded-xl border border-[#A07D34]/40 bg-[#A07D34]/5 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => filesRef.current?.click()} disabled={!!busy} className="inline-flex items-center gap-2 rounded-md bg-[#1B2A4A] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#243a63] disabled:opacity-50"><Upload className="h-4 w-4" /> Upload files</button>
            <button onClick={() => folderRef.current?.click()} disabled={!!busy} className="inline-flex items-center gap-2 rounded-md border border-[#1B2A4A]/40 px-3 py-1.5 text-sm font-semibold text-[#1B2A4A] hover:bg-white disabled:opacity-50"><FolderUp className="h-4 w-4" /> Upload a folder</button>
            <span className="text-xs text-muted-foreground">Folders are sorted into categories automatically by AI.</span>
            {busy && <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-[#A07D34]"><Loader2 className="h-4 w-4 animate-spin" /> {busy}</span>}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs">Google Drive / web link<br /><input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/…" className="w-72 rounded border border-slate-300 px-2 py-1 text-sm" /></label>
            <label className="text-xs">Title<br /><input value={driveTitle} onChange={(e) => setDriveTitle(e.target.value)} placeholder="What is it?" className="w-52 rounded border border-slate-300 px-2 py-1 text-sm" /></label>
            <button onClick={addDrive} disabled={!!busy} className="inline-flex items-center gap-2 rounded-md border border-[#1B2A4A]/40 px-3 py-1.5 text-sm font-semibold text-[#1B2A4A] hover:bg-white disabled:opacity-50"><Link2 className="h-4 w-4" /> Add link</button>
          </div>
          <input ref={filesRef} type="file" multiple hidden onChange={(e) => doUpload(e.target.files)} />
          {/* @ts-expect-error non-standard folder-picker attributes */}
          <input ref={folderRef} type="file" hidden webkitdirectory="" directory="" multiple onChange={(e) => doUpload(e.target.files)} />
        </div>
      )}

      {/* Featured (bundled) */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-[#1B2A4A]">Featured</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((c) => <FeaturedCard key={c.file} c={c} />)}
        </div>
      </section>

      {/* Uploaded, grouped by AI category */}
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-muted-foreground">No uploaded files yet.{canManage ? ' Use “Upload files” or “Upload a folder” above.' : ''}</p>
      ) : (
        [...orderedCats, ...extraCats].map((cat) => (
          <section key={cat}>
            <h2 className="mb-2 text-sm font-semibold text-[#1B2A4A]">{cat} <span className="font-normal text-muted-foreground">· {byCat.get(cat)!.length}</span></h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {byCat.get(cat)!.map((it) => <ItemCard key={it.id} it={it} canManage={canManage} onRemove={remove} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function FeaturedCard({ c }: { c: Collateral }) {
  const Icon = KIND_ICON[c.kind] ?? FileText;
  const showImg = c.kind === 'image' || c.kind === 'brand';
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {showImg ? (
        <a href={c.file} target="_blank" rel="noopener noreferrer" className="block bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.file} alt={c.title} className="h-32 w-full object-contain p-2" />
        </a>
      ) : (
        <div className="flex h-32 items-center justify-center bg-slate-50"><Icon className="h-10 w-10 text-[#A07D34]" /></div>
      )}
      <div className="border-t border-slate-100 p-3">
        <p className="truncate text-sm font-semibold text-[#1B2A4A]">{c.title}</p>
        <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
        <div className="flex gap-3 text-xs">
          <a href={c.file} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#1B2A4A] hover:underline"><ExternalLink className="h-3 w-3" /> View</a>
          <a href={c.file} download className="inline-flex items-center gap-1 text-[#1B2A4A] hover:underline"><Download className="h-3 w-3" /> Download</a>
        </div>
      </div>
    </div>
  );
}

function ItemCard({ it, canManage, onRemove }: { it: LibraryItem; canManage: boolean; onRemove: (id: string) => void }) {
  const Icon = KIND_ICON[it.kind] ?? FileText;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {it.kind === 'image' ? (
        <a href={it.url} target="_blank" rel="noopener noreferrer" className="block bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={it.url} alt={it.title} className="h-32 w-full object-cover" />
        </a>
      ) : (
        <div className="flex h-32 items-center justify-center bg-slate-50"><Icon className="h-10 w-10 text-[#A07D34]" /></div>
      )}
      <div className="border-t border-slate-100 p-3">
        <p className="truncate text-sm font-semibold text-[#1B2A4A]" title={it.title}>{it.title}</p>
        <p className="mb-2 text-[11px] text-muted-foreground">{it.source === 'DRIVE' ? 'Google Drive / link' : it.fileType || 'file'}{it.folderPath ? ` · ${it.folderPath}` : ''}</p>
        <div className="flex items-center gap-3 text-xs">
          {isViewable(it.kind) && <a href={it.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#1B2A4A] hover:underline"><ExternalLink className="h-3 w-3" /> {it.source === 'DRIVE' ? 'Open in Drive' : 'View'}</a>}
          {it.source !== 'DRIVE' && <a href={it.url} download className="inline-flex items-center gap-1 text-[#1B2A4A] hover:underline"><Download className="h-3 w-3" /> Download</a>}
          {canManage && <button onClick={() => onRemove(it.id)} className="ml-auto inline-flex items-center gap-1 text-rose-600 hover:underline"><Trash2 className="h-3 w-3" /></button>}
        </div>
      </div>
    </div>
  );
}

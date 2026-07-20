'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Folder, FileText, Upload, FolderPlus, ChevronRight, Home, Download, Eye, Loader2, History, Shield, MoreVertical, CalendarClock, Sparkles, Pencil, FolderInput, HardDrive, Lock } from 'lucide-react';
import { createFolder, updateDocumentExpiry, summarizeDocument, renameDocument, moveDocument, sendDocumentToDrive } from '@/server/actions/documents';
import { FileDropzone } from './file-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { FolderAccessDialog } from './folder-access-dialog';
import { formatDate, titleCase } from '@/lib/utils/format';

interface FolderRow { id: string; name: string; visibility: string; docs: number; subfolders: number; locked?: boolean; lockReason?: string | null }
interface DocRow { id: string; title: string; versions: number; owner: string | null; updatedAt: string; expiresAt: string | null; fileId: string | null; size: number | null; mime: string | null; summary: string | null; driveUrl: string | null }
interface Opt { id: string; name: string }
interface Perm { id: string; level: string; who: string; kind: string }
function bytes(n: number | null) { if (!n) return ''; const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let v = n; while (v >= 1024 && i < 3) { v /= 1024; i++; } return `${v.toFixed(0)} ${u[i]}`; }

export function DocumentsView({
  folderId, folderName, crumbs, folders, documents, projects, canManage, permissions, users, departments, geminiEnabled, driveEnabled, allFolders,
}: {
  folderId: string | null; folderName: string; crumbs: { id: string; name: string }[]; allFolders: Opt[];
  folders: FolderRow[]; documents: DocRow[]; projects: Opt[];
  canManage: boolean; permissions: Perm[]; users: Opt[]; departments: Opt[]; geminiEnabled: boolean; driveEnabled: boolean;
}) {
  const router = useRouter();
  const [newFolder, setNewFolder] = React.useState(false);
  const [upload, setUpload] = React.useState(false);
  const [access, setAccess] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [moveDoc, setMoveDoc] = React.useState<DocRow | null>(null);
  const toDrive = (id: string) => { setBusyId(id); start(async () => { const r = await sendDocumentToDrive(id); setBusyId(null); if ('error' in r) return toast.error(r.error); toast.success('Copied to Google Drive'); router.refresh(); }); };
  const doRename = (d: DocRow) => { const v = prompt('Rename document:', d.title); if (v && v.trim()) start(async () => { const r = await renameDocument(d.id, v.trim()); if ('error' in r) return toast.error(r.error); toast.success('Renamed'); router.refresh(); }); };
  const doMove = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); if (!moveDoc) return; const fd = new FormData(e.currentTarget); const target = String(fd.get('folderId') || ''); if (!target) return; start(async () => { const r = await moveDocument(moveDoc.id, target); if ('error' in r) return toast.error(r.error); toast.success('Moved'); setMoveDoc(null); router.refresh(); }); };

  const submitFolder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    start(async () => { const res = await createFolder({ name: fd.get('name'), parentId: folderId, projectId: fd.get('projectId') || null, visibility: fd.get('visibility') }); if ('error' in res) return toast.error(res.error); toast.success('Folder created'); setNewFolder(false); router.refresh(); });
  };
  const setExpiry = (id: string) => { const v = prompt('Expiry date (YYYY-MM-DD):'); if (v) start(async () => { const r = await updateDocumentExpiry(id, v); if ('error' in r) return toast.error(r.error); toast.success('Expiry set'); router.refresh(); }); };
  const clearExpiry = (id: string) => start(async () => { const r = await updateDocumentExpiry(id, null); if ('error' in r) return toast.error(r.error); toast.success('Expiry cleared'); router.refresh(); });
  const summarize = (id: string) => { setBusyId(id); start(async () => { const r = await summarizeDocument(id); setBusyId(null); if ('error' in r) return toast.error(r.error); toast.success('AI summary ready'); router.refresh(); }); };

  const expiringSoon = documents.filter((d) => d.expiresAt && new Date(d.expiresAt).getTime() < Date.now() + 30 * 864e5);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/documents" className="flex items-center gap-1 hover:text-foreground"><Home className="h-4 w-4" /> Library</Link>
          {crumbs.map((c) => (<span key={c.id} className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /><Link href={`/documents?folder=${c.id}`} className="hover:text-foreground">{c.name}</Link></span>))}
        </nav>
        <div className="flex gap-2">
          {folderId && canManage && <Button size="sm" variant="outline" onClick={() => setAccess(true)}><Shield className="h-4 w-4" /> Manage access</Button>}
          <Button size="sm" variant="outline" onClick={() => setNewFolder(true)}><FolderPlus className="h-4 w-4" /> New folder</Button>
          <Button size="sm" onClick={() => setUpload(true)} disabled={!folderId}><Upload className="h-4 w-4" /> Upload</Button>
        </div>
      </div>

      {expiringSoon.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-brass-deep">
          <CalendarClock className="h-4 w-4" /> {expiringSoon.length} document(s) expiring within 30 days.
        </div>
      )}

      {folders.length === 0 && documents.length === 0 && <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">This folder is empty.</p>}

      {folders.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {folders.map((f) => {
            // Locked folders are still shown. People should know the folder
            // exists — they just cannot open it.
            const card = (
              <Card className={cn(
                'flex items-center gap-3 p-4 transition-colors',
                f.locked ? 'cursor-not-allowed opacity-70' : 'hover:border-primary hover:bg-secondary/40',
              )}>
                {f.locked ? <Lock className="h-8 w-8 shrink-0 text-muted-foreground" /> : <Folder className="h-8 w-8 shrink-0 text-brass" />}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.locked ? (f.lockReason ?? 'Restricted') : `${f.subfolders} folders - ${f.docs} files`}
                  </p>
                </div>
              </Card>
            );
            return f.locked
              ? <div key={f.id} title={f.lockReason ?? 'You do not have access to this folder'}>{card}</div>
              : <Link key={f.id} href={`/documents?folder=${f.id}`}>{card}</Link>;
          })}
        </div>
      )}

      {documents.length > 0 && (
        <Card className="divide-y">
          {documents.map((d) => (
            <div key={d.id} className="p-3">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{bytes(d.size)} - {d.owner ?? 'Unknown'} - {formatDate(d.updatedAt)}{d.expiresAt && <span className="ml-1 text-destructive">- expires {formatDate(d.expiresAt)}</span>}</p>
                </div>
                <Badge variant="secondary" className="gap-1"><History className="h-3 w-3" /> v{d.versions}</Badge>
                {d.fileId && <Button asChild variant="ghost" size="icon" title="Preview"><a href={`/api/files/${d.fileId}`} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" /></a></Button>}
                {d.fileId && <Button asChild variant="ghost" size="icon" title="Download"><a href={`/api/files/${d.fileId}?download=1`}><Download className="h-4 w-4" /></a></Button>}
                {d.driveUrl && <Button asChild variant="ghost" size="icon" title="Open in Google Drive"><a href={d.driveUrl} target="_blank" rel="noreferrer"><HardDrive className="h-4 w-4 text-emerald-600" /></a></Button>}
                {(
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon">{busyId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}</Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {geminiEnabled && <DropdownMenuItem onClick={() => summarize(d.id)}><Sparkles className="h-4 w-4" /> {d.summary ? 'Re-summarize with AI' : 'Summarize with AI'}</DropdownMenuItem>}
                      {driveEnabled && <DropdownMenuItem onClick={() => toDrive(d.id)}><HardDrive className="h-4 w-4" /> {d.driveUrl ? 'Re-send to Drive' : 'Send to Google Drive'}</DropdownMenuItem>}
                      <DropdownMenuItem onClick={() => doRename(d)}><Pencil className="h-4 w-4" /> Rename</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setMoveDoc(d)}><FolderInput className="h-4 w-4" /> Move to folder...</DropdownMenuItem>
                      {canManage && <DropdownMenuItem onClick={() => setExpiry(d.id)}><CalendarClock className="h-4 w-4" /> Set expiry...</DropdownMenuItem>}
                      {canManage && d.expiresAt && <DropdownMenuItem onClick={() => clearExpiry(d.id)}>Clear expiry</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {d.summary && (
                <div className="mt-2 flex gap-2 rounded-md border border-primary/20 bg-primary/5 p-2.5">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <p className="whitespace-pre-wrap text-xs text-foreground/80">{d.summary}</p>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      <Dialog open={newFolder} onOpenChange={setNewFolder}>
        <DialogContent>
          <DialogHeader><DialogTitle>New folder</DialogTitle></DialogHeader>
          <form onSubmit={submitFolder} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" required autoFocus /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="visibility">Visibility</Label><select id="visibility" name="visibility" defaultValue="DEPARTMENT" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{['PRIVATE', 'DEPARTMENT', 'PROJECT', 'ORGANIZATION'].map((v) => <option key={v} value={v}>{titleCase(v)}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="projectId">Project</Label><select id="projectId" name="projectId" defaultValue="" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">-</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setNewFolder(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Create</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={upload} onOpenChange={setUpload}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Upload files</DialogTitle></DialogHeader>
          {folderId
            ? <FileDropzone folderId={folderId} onFinished={() => setUpload(false)} />
            : <p className="text-sm text-muted-foreground">Open a folder first.</p>}
          {geminiEnabled && <p className="mt-2 text-xs text-muted-foreground"><Sparkles className="mr-1 inline h-3 w-3 text-primary" />PDFs and images get an automatic AI summary.</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!moveDoc} onOpenChange={(o) => !o && setMoveDoc(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Move &ldquo;{moveDoc?.title}&rdquo;</DialogTitle></DialogHeader>
          <form onSubmit={doMove} className="space-y-3">
            <div className="space-y-1"><Label htmlFor="moveTarget">Destination folder</Label>
              <select id="moveTarget" name="folderId" defaultValue="" required className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="" disabled>Choose folder...</option>
                {allFolders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setMoveDoc(null)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Move</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {folderId && <FolderAccessDialog open={access} onOpenChange={setAccess} folderId={folderId} folderName={folderName} permissions={permissions} users={users} departments={departments} />}
    </div>
  );
}

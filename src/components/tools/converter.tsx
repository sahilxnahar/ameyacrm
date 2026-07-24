'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Loader2, FilesIcon, Scissors, Image as ImageIcon, Table2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { mergePdfs, extractPdfPages, imagesToPdf, toXlsx, toCsv, toJson, toMarkdown, download, reExt } from '@/lib/tools/convert';

type Busy = string | null;

export function Converter() {
  const [busy, setBusy] = React.useState<Busy>(null);
  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try { await fn(); }
    catch (e) { toast.error(e instanceof Error ? `Could not convert: ${e.message}` : 'Could not convert that file.'); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <Card className="flex items-start gap-2 border-primary/30 bg-primary/5 p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-muted-foreground">Everything here runs on your device — files are never uploaded and no AI credits are used. Big files stay fast because nothing leaves your browser.</p>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">PDF tools</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <MergePdf busy={busy} run={run} />
          <ExtractPages busy={busy} run={run} />
          <ImagesToPdf busy={busy} run={run} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Spreadsheets &amp; data</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <SheetConvert busy={busy} run={run} />
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Not here yet: PDF → editable Word, and PDF → images. Those need a full page-rendering / OCR engine (they can’t be done reliably with a library alone), so they’re deliberately left out rather than done badly.
      </p>
    </div>
  );
}

function ToolCard({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <p className="font-medium">{title}</p>
      </div>
      <p className="text-xs text-muted-foreground">{desc}</p>
      <div className="mt-auto space-y-2">{children}</div>
    </Card>
  );
}

const PDF_ACCEPT = '.pdf,application/pdf';
const IMG_ACCEPT = '.jpg,.jpeg,.png,image/jpeg,image/png';
const SHEET_ACCEPT = '.csv,.tsv,.txt,.xlsx,.xls,.xlsm,.xlsb,.ods,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

interface ToolProps { busy: Busy; run: (id: string, fn: () => Promise<void>) => Promise<void>; }

function MergePdf({ busy, run }: ToolProps) {
  const [files, setFiles] = React.useState<File[]>([]);
  return (
    <ToolCard icon={<FilesIcon className="h-4 w-4" />} title="Merge PDFs" desc="Combine two or more PDFs into one, in the order you pick them.">
      <Input type="file" accept={PDF_ACCEPT} multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} file{files.length === 1 ? '' : 's'} selected</p>}
      <Button size="sm" className="w-full" disabled={busy !== null || files.length < 2}
        onClick={() => run('merge', async () => {
          const blob = await mergePdfs(files);
          download(blob, 'merged.pdf');
          toast.success(`Merged ${files.length} PDFs`);
        })}>
        {busy === 'merge' ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Merge {files.length >= 2 ? `${files.length} PDFs` : '(pick 2+)'}
      </Button>
    </ToolCard>
  );
}

function ExtractPages({ busy, run }: ToolProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [from, setFrom] = React.useState('1');
  const [to, setTo] = React.useState('');
  return (
    <ToolCard icon={<Scissors className="h-4 w-4" />} title="Extract PDF pages" desc="Pull a page range out of a PDF into a new, smaller PDF.">
      <Input type="file" accept={PDF_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <div className="flex items-center gap-2">
        <Label className="text-xs">Pages</Label>
        <Input className="h-8 w-16" type="number" min="1" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="1" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input className="h-8 w-16" type="number" min="1" value={to} onChange={(e) => setTo(e.target.value)} placeholder="end" />
      </div>
      <Button size="sm" className="w-full" disabled={busy !== null || !file}
        onClick={() => run('extract', async () => {
          if (!file) return;
          const { blob, pages } = await extractPdfPages(file, Number(from), Number(to));
          download(blob, reExt(file.name, 'pdf').replace(/\.pdf$/, '') + `-p${from}${to ? `-${to}` : ''}.pdf`);
          toast.success(`Extracted ${pages} page${pages === 1 ? '' : 's'}`);
        })}>
        {busy === 'extract' ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Extract pages
      </Button>
    </ToolCard>
  );
}

function ImagesToPdf({ busy, run }: ToolProps) {
  const [files, setFiles] = React.useState<File[]>([]);
  return (
    <ToolCard icon={<ImageIcon className="h-4 w-4" />} title="Images → PDF" desc="Turn JPG/PNG photos or scans into a single PDF, one image per page.">
      <Input type="file" accept={IMG_ACCEPT} multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} image{files.length === 1 ? '' : 's'} selected</p>}
      <Button size="sm" className="w-full" disabled={busy !== null || files.length < 1}
        onClick={() => run('img2pdf', async () => {
          const blob = await imagesToPdf(files);
          download(blob, 'images.pdf');
          toast.success(`Built a PDF from ${files.length} image${files.length === 1 ? '' : 's'}`);
        })}>
        {busy === 'img2pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Make PDF
      </Button>
    </ToolCard>
  );
}

const TARGETS = [
  { id: 'xlsx', label: 'Excel (.xlsx)', ext: 'xlsx', fn: toXlsx },
  { id: 'csv', label: 'CSV (.csv)', ext: 'csv', fn: toCsv },
  { id: 'json', label: 'JSON (.json)', ext: 'json', fn: toJson },
  { id: 'md', label: 'Markdown table (.md)', ext: 'md', fn: toMarkdown },
] as const;

function SheetConvert({ busy, run }: ToolProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [target, setTarget] = React.useState<(typeof TARGETS)[number]['id']>('xlsx');
  const t = TARGETS.find((x) => x.id === target)!;
  return (
    <ToolCard icon={<Table2 className="h-4 w-4" />} title="Convert a spreadsheet" desc="CSV or Excel in — Excel, CSV, JSON or a Markdown table out.">
      <Input type="file" accept={SHEET_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <div className="flex items-center gap-2">
        <Label className="text-xs">Convert to</Label>
        <select value={target} onChange={(e) => setTarget(e.target.value as typeof target)} className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm">
          {TARGETS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </div>
      <Button size="sm" className="w-full" disabled={busy !== null || !file}
        onClick={() => run('sheet', async () => {
          if (!file) return;
          const blob = await t.fn(file);
          download(blob, reExt(file.name, t.ext));
          toast.success(`Converted to ${t.label}`);
        })}>
        {busy === 'sheet' ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Convert &amp; download
      </Button>
    </ToolCard>
  );
}

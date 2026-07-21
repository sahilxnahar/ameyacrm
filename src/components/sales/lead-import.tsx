'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Upload, Loader2, Download, CheckCircle2 } from 'lucide-react';
import { importLeadsCsv } from '@/server/actions/import';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const TEMPLATE = 'name,email,phone,source,requirement,budget\nRahul Sharma,rahul@example.com,9840490000,website,3BHK park-facing,15000000\n';

export function LeadImport() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [text, setText] = React.useState('');
  const [fileName, setFileName] = React.useState('');
  const [result, setResult] = React.useState<{ created: number; deduped: number; errors: number } | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return; setFileName(f.name);
    const reader = new FileReader(); reader.onload = () => setText(String(reader.result || '')); reader.readAsText(f);
  };
  const run = () => { if (!text.trim()) { toast.error('Choose a CSV file first.'); return; } start(async () => { const r = await importLeadsCsv(text); if ('error' in r) { toast.error(r.error); return; } setResult(r); toast.success(`Imported ${r.created} leads`); router.refresh(); }); };
  const downloadTemplate = () => { const a = document.createElement('a'); a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`; a.download = 'leads-template.csv'; a.click(); };

  return (
    <Card><CardContent className="space-y-4 p-6">
      <p className="text-sm text-muted-foreground">Upload a CSV to bulk‑import leads. Required column: <b>name</b>. Optional: email, phone, source, requirement, budget. Duplicates (matching phone or email) are skipped automatically.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="h-4 w-4" /> Download template</Button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-secondary/40">
          <Upload className="h-4 w-4" /> {fileName || 'Choose CSV…'}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </label>
        <Button size="sm" onClick={run} disabled={pending || !text.trim()}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Import leads</Button>
      </div>
      {result && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span><b>{result.created}</b> created · <b>{result.deduped}</b> duplicates skipped{result.errors ? ` · ${result.errors} rows with errors` : ''}.</span>
        </div>
      )}
    </CardContent></Card>
  );
}

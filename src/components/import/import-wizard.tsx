'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ClipboardPaste, Eye, Upload, CheckCircle2, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { runImport, type ImportResult, type RowResult } from '@/server/actions/bulk-import';
import { parseTable, autoMap } from '@/lib/import/parse';
import type { ImportKind } from '@/lib/import/schemas';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

const SELECT = 'h-9 rounded-md border border-input bg-background px-2 text-sm';

export function ImportWizard({
  kinds, projects, counts,
}: {
  kinds: ImportKind[];
  projects: { id: string; name: string }[];
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [kindKey, setKindKey] = React.useState<ImportKind['key']>(kinds[0]?.key ?? 'units');
  const [projectId, setProjectId] = React.useState(projects[0]?.id ?? '');
  const [text, setText] = React.useState('');
  const [map, setMap] = React.useState<Record<string, number>>({});
  const [preview, setPreview] = React.useState<ImportResult | null>(null);
  const [done, setDone] = React.useState<ImportResult | null>(null);

  const kind = kinds.find((k) => k.key === kindKey)!;
  const parsed = React.useMemo(() => parseTable(text), [text]);

  // Re-guess the mapping whenever the pasted data or the import type changes.
  React.useEffect(() => {
    if (parsed.headers.length) setMap(autoMap(parsed.headers, kind.fields));
    setPreview(null); setDone(null);
  }, [text, kindKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = React.useMemo(() => parsed.rows.map((r) => {
    const o: Record<string, string> = {};
    for (const f of kind.fields) {
      const i = map[f.key];
      o[f.key] = i === undefined ? '' : (r[i] ?? '');
    }
    return o;
  }), [parsed, map, kind]);

  const missingRequired = kind.fields.filter((f) => f.required && map[f.key] === undefined);

  const go = (dryRun: boolean) =>
    start(async () => {
      const res = await runImport(kindKey, projectId || null, rows, dryRun);
      if ('error' in res) { toast.error(res.error); return; }
      if (dryRun) { setPreview(res); toast.success('Preview ready — nothing has been saved yet'); }
      else {
        setDone(res); setPreview(null);
        toast.success(`${res.created} created, ${res.updated} updated`);
        router.refresh();
      }
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {kinds.map((k) => (
          <button key={k.key} onClick={() => setKindKey(k.key)}
            className={cn('rounded-lg border p-3 text-left transition-colors',
              kindKey === k.key ? 'border-primary bg-primary/5' : 'hover:bg-secondary/50')}>
            <span className="block text-sm font-medium">{k.label}</span>
            <span className="block text-xs text-muted-foreground">{counts[k.key] ?? 0} in the system</span>
          </button>
        ))}
      </div>

      <Card className="p-4">
        <p className="text-sm text-muted-foreground">{kind.description}</p>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          {(kindKey === 'units' || kindKey === 'leads' || kindKey === 'customers') && (
            <div className="space-y-1.5">
              <Label htmlFor="project">Project</Label>
              <select id="project" className={SELECT} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">—</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setText(kind.sample)}>
            <ClipboardPaste className="h-4 w-4" /> Fill an example
          </Button>
        </div>

        <div className="mt-3 space-y-1.5">
          <Label htmlFor="paste">Paste your rows — include the header row</Label>
          <Textarea id="paste" rows={7} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={'Select the cells in Excel, copy, and paste here.\nThe first line must be your column headings.'}
            className="font-mono text-xs" />
          {parsed.headers.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Read <span className="font-medium">{parsed.rows.length}</span> rows and {parsed.headers.length} columns.
            </p>
          )}
        </div>
      </Card>

      {parsed.headers.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-semibold">Which column is which?</p>
          <p className="mb-3 text-xs text-muted-foreground">Guessed from your headings — change anything that looks wrong.</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {kind.fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={f.key} className="text-xs">
                  {f.label} {f.required && <span className="text-destructive">*</span>}
                  {f.hint && <span className="font-normal opacity-70"> — {f.hint}</span>}
                </Label>
                <select id={f.key} className={cn(SELECT, 'w-full', f.required && map[f.key] === undefined && 'border-destructive')}
                  value={map[f.key] ?? ''} onChange={(e) => setMap({ ...map, [f.key]: e.target.value === '' ? undefined as never : Number(e.target.value) })}>
                  <option value="">— not in my data —</option>
                  {parsed.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </div>
            ))}
          </div>

          {missingRequired.length > 0 && (
            <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> Still needed: {missingRequired.map((f) => f.label).join(', ')}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={pending || missingRequired.length > 0} onClick={() => go(true)}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Check it first
            </Button>
            {preview && (
              <Button variant="default" disabled={pending} onClick={() => go(false)}>
                <Upload className="h-4 w-4" /> Import {'ok' in preview ? preview.created + preview.updated : 0} rows
              </Button>
            )}
          </div>
        </Card>
      )}

      {(preview || done) && <Report res={(done ?? preview)!} isDone={Boolean(done)} />}
    </div>
  );
}

function Report({ res, isDone }: { res: ImportResult; isDone: boolean }) {
  if ('error' in res) return null;
  const bad = res.results.filter((r) => !r.ok);
  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        {isDone ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Eye className="h-4 w-4" />}
        {isDone ? 'Imported' : 'Preview — nothing saved yet'}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        <Badge variant="success">{res.created} new</Badge>
        {res.updated > 0 && <Badge variant="secondary">{res.updated} updated</Badge>}
        {res.skipped > 0 && <Badge variant="warning">{res.skipped} already there</Badge>}
        {res.failed > 0 && <Badge variant="destructive">{res.failed} with problems</Badge>}
      </div>

      {bad.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-destructive">
            <XCircle className="h-4 w-4" /> These rows need fixing
          </p>
          <ul className="max-h-52 space-y-1 overflow-y-auto text-xs">
            {bad.slice(0, 60).map((r: RowResult) => (
              <li key={r.row} className="flex gap-2">
                <span className="shrink-0 font-mono text-muted-foreground">row {r.row}</span>
                <span>{r.message}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Fix them in your spreadsheet and paste again — the good rows import either way.
          </p>
        </div>
      )}

      {!isDone && res.failed === 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-success">
          <ArrowRight className="h-4 w-4" /> All rows look fine. Press Import to save them.
        </p>
      )}
    </Card>
  );
}

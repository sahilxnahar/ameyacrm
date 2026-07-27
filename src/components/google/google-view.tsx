'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Loader2, FileSpreadsheet, FolderOpen, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { exportToSheet, type Dataset } from '@/server/actions/google-workspace';

interface FileRow { id: string; name: string; mimeType: string; url: string }

const EXPORTS: { key: Dataset; label: string; permKey: 'leads' | 'vendors' | 'bookings' }[] = [
  { key: 'leads', label: 'Leads', permKey: 'leads' },
  { key: 'vendors', label: 'Vendors', permKey: 'vendors' },
  { key: 'bookings', label: 'Bookings', permKey: 'bookings' },
];

export function GoogleView({
  configured, folder, statusError, files, can,
}: {
  configured: boolean;
  folder: string | null;
  statusError: string | null;
  files: FileRow[];
  can: { leads: boolean; vendors: boolean; bookings: boolean };
}) {
  const [busy, setBusy] = React.useState<Dataset | null>(null);

  const run = (d: Dataset) => {
    setBusy(d);
    void (async () => {
      const r = await exportToSheet(d);
      setBusy(null);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`Exported ${r.rows} rows to the "${r.tab}" tab of your Google Sheet.`);
    })();
  };

  const exports = EXPORTS.filter((e) => can[e.permKey]);

  return (
    <div className="space-y-5">
      {/* Connection status */}
      <Card className="p-4">
        {!configured ? (
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium">The Google connector isn&apos;t set up.</p>
              <p className="text-muted-foreground">Add <code className="rounded bg-muted px-1">GAS_WEBAPP_URL</code> and <code className="rounded bg-muted px-1">GAS_SECRET</code> in Vercel, then redeploy.</p>
            </div>
          </div>
        ) : statusError ? (
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">Connected, but the last check failed.</p>
              <p className="text-muted-foreground">{statusError}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <p><span className="font-medium">Connected</span> — files sync to your Drive folder{folder ? <> “<span className="font-medium">{folder}</span>”</> : ''}, no Google Cloud Console.</p>
          </div>
        )}
      </Card>

      {/* Export to Google Sheet */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base">Export to Google Sheet</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Writes the current list into a tab of your linked Google Sheet (overwrites that tab).</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {exports.length === 0 && <p className="text-sm text-muted-foreground">You don&apos;t have permission to export any lists.</p>}
          {exports.map((e) => (
            <Button key={e.key} size="sm" variant="outline" disabled={!configured || busy !== null} onClick={() => run(e.key)}>
              {busy === e.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Export {e.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Drive files */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base">Drive files</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Files the CRM has saved to your Drive folder.</p>
        {files.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{configured ? 'No files yet — documents you upload in the CRM are copied here.' : 'Connect the Google connector to see your Drive files.'}</p>
        ) : (
          <ul className="mt-3 divide-y rounded-md border">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 p-2.5 text-sm">
                <span className="truncate">{f.name}</span>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline">
                  Open <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

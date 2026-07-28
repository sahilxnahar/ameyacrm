'use client';
import * as React from 'react';
import Link from 'next/link';
import { Printer, ArrowLeft, ExternalLink, ShieldCheck, ShieldAlert, FileText } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BrandWatermark } from '@/components/layout/brand-watermark';

export interface RecordDetail {
  id: string;
  project: string;
  recordType: string;
  state: string;
  region: string | null;
  authorityName: string;
  reference: string | null;
  documentUrl: string | null;
  validUntil: string | null;
  status: string;
  note: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = { VERIFIED: 'success', PENDING: 'warning', REJECTED: 'destructive', EXPIRED: 'destructive' };
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'; }

/**
 * A single Due-Diligence record, presented as a macOS-style inspector on desktop
 * and a print-ready legal document. The app chrome (top-bar, dock, sidebar) is
 * hidden on print by the global print stylesheet; this card carries the
 * `print-document` class so it never breaks across pages, plus the high-res
 * document watermark. "Print" opens the browser's print/PDF dialog for a
 * court/certifier-grade output.
 */
export function RecordDetailView({ record }: { record: RecordDetail }) {
  const overdue = record.validUntil ? new Date(record.validUntil).getTime() < Date.now() : false;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Controls — hidden on print. */}
      <div className="flex items-center justify-between print:hidden">
        <Link href="/due-diligence" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to vault
        </Link>
        <div className="flex items-center gap-2">
          {record.documentUrl ? (
            <a href={record.documentUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1"><ExternalLink className="h-4 w-4" /> Open file</Button>
            </a>
          ) : null}
          <Button size="sm" className="gap-1" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
        </div>
      </div>

      {/* The document. */}
      <article className="print-document relative overflow-hidden rounded-xl border bg-card p-6 shadow-sm sm:p-10 print:rounded-none print:border-0 print:shadow-none">
        <BrandWatermark variant="document" />

        <div className="relative z-10">
          {/* Letterhead */}
          <header className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <img src="/brand/mark-gold-dark.svg" alt="" className="hidden h-9 w-9 dark:block print:hidden" />
              <img src="/brand/mark-gold-light.svg" alt="" className="h-9 w-9 dark:hidden" />
              <div>
                <div className="text-lg font-semibold tracking-tight">Ameya Heights</div>
                <div className="text-xs text-muted-foreground print:text-black">Due Diligence Record</div>
              </div>
            </div>
            <Badge variant={STATUS_TONE[record.status] ?? 'secondary'} className="print:border print:border-black">
              {record.status === 'VERIFIED' ? <ShieldCheck className="mr-1 h-3.5 w-3.5" /> : overdue ? <ShieldAlert className="mr-1 h-3.5 w-3.5" /> : null}
              {record.status}
            </Badge>
          </header>

          <h1 className="mt-6 text-xl font-semibold print:text-black">{record.recordType.replace(/_/g, ' ')}</h1>
          <p className="mt-1 text-sm text-muted-foreground print:text-black">Issued / held via {record.authorityName}</p>

          <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <Field label="Project" value={record.project} />
            <Field label="Authority" value={record.authorityName} />
            <Field label="State" value={record.state} />
            <Field label="Region" value={record.region ?? '—'} />
            <Field label="Reference no." value={record.reference ?? '—'} mono />
            <Field label="Valid until" value={fmt(record.validUntil)} tone={overdue ? 'bad' : undefined} />
            <Field label="Filed on" value={fmt(record.createdAt)} />
            <Field label="Verification" value={record.status} />
          </dl>

          {record.note ? (
            <div className="mt-6 rounded-md bg-muted/40 p-3 text-sm print:bg-transparent print:text-black">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground print:text-black">Note</div>
              {record.note}
            </div>
          ) : null}

          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground print:text-black">
            <FileText className="h-3.5 w-3.5" />
            {record.documentUrl ? 'Source document attached and stored in the Ameya Heights vault.' : 'No source document attached.'}
          </div>

          <footer className="mt-10 flex items-end justify-between border-t pt-4 text-xs text-muted-foreground print:text-black">
            <span>Generated from the Ameya Heights Due Diligence Vault · record #{record.id.slice(-8)}</span>
            <span className="hidden print:block">Authorised signatory: ______________________</span>
          </footer>
        </div>
      </article>
    </div>
  );
}

function Field({ label, value, mono, tone }: { label: string; value: string; mono?: boolean; tone?: 'bad' }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground print:text-black">{label}</dt>
      <dd className={cn('mt-0.5 text-sm print:text-black', mono && 'font-mono', tone === 'bad' && 'text-destructive')}>{value}</dd>
    </div>
  );
}

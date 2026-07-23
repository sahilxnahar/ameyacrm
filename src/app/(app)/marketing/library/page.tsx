import type { Metadata } from 'next';
import { ImageIcon, FileText, FileSpreadsheet, Box, Sparkles, Download, ExternalLink } from 'lucide-react';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { MARKETING_COLLATERALS, type Collateral } from '@/config/marketing-collaterals';

export const metadata: Metadata = { title: 'Marketing Library' };
export const dynamic = 'force-dynamic';

const KIND = {
  image: { icon: ImageIcon, label: 'Image', tone: 'text-emerald-600' },
  pdf: { icon: FileText, label: 'PDF', tone: 'text-rose-600' },
  excel: { icon: FileSpreadsheet, label: 'Spreadsheet', tone: 'text-green-700' },
  html: { icon: Box, label: '3D / Web', tone: 'text-indigo-600' },
  brand: { icon: Sparkles, label: 'Brand asset', tone: 'text-[#A07D34]' },
} as const;

export default async function MarketingLibraryPage() {
  await requirePermission('marketing.view');
  const images = MARKETING_COLLATERALS.filter((c) => c.kind === 'image' || c.kind === 'brand');
  const docs = MARKETING_COLLATERALS.filter((c) => c.kind !== 'image' && c.kind !== 'brand');
  return (
    <div className="space-y-6">
      <PageHeader title="Marketing Library" description="Your Ameya marketing collaterals — renders, brochures, comparisons and brand assets, always here to view or download." />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-[#1B2A4A]">Renders & brand</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((c) => (
            <figure key={c.file} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <a href={c.file} target="_blank" rel="noopener noreferrer" className="block bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.file} alt={c.title} className="h-44 w-full object-contain p-2" />
              </a>
              <figcaption className="border-t border-slate-100 p-3">
                <p className="text-sm font-semibold text-[#1B2A4A]">{c.title}</p>
                <p className="mb-2 text-xs text-muted-foreground">{c.description}</p>
                <div className="flex gap-3 text-xs">
                  <a href={c.file} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#1B2A4A] hover:underline"><ExternalLink className="h-3 w-3" /> View</a>
                  <a href={c.file} download className="inline-flex items-center gap-1 text-[#1B2A4A] hover:underline"><Download className="h-3 w-3" /> Download</a>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-[#1B2A4A]">Documents & tools</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((c) => <DocCard key={c.file} c={c} />)}
        </div>
      </section>
    </div>
  );
}

function DocCard({ c }: { c: Collateral }) {
  const k = KIND[c.kind];
  const Icon = k.icon;
  const isView = c.kind === 'html' || c.kind === 'pdf';
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className={`mt-0.5 shrink-0 ${k.tone}`}><Icon className="h-6 w-6" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#1B2A4A]">{c.title}</p>
        <p className="mb-2 text-xs text-muted-foreground">{c.description}</p>
        <div className="flex gap-3 text-xs">
          {isView && <a href={c.file} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#1B2A4A] hover:underline"><ExternalLink className="h-3 w-3" /> Open</a>}
          <a href={c.file} download className="inline-flex items-center gap-1 text-[#1B2A4A] hover:underline"><Download className="h-3 w-3" /> Download</a>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { Converter } from '@/components/tools/converter';

export const metadata: Metadata = { title: 'File tools' };

export default async function ToolsPage() {
  await requireAuth();
  return (
    <div className="space-y-6">
      <PageHeader title="File tools" description="Convert PDFs and spreadsheets right here — merge, split, images to PDF, and CSV/Excel/JSON/Markdown. All on your device, no AI credits used." />
      <Converter />
    </div>
  );
}

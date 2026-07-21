import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { GlossaryView } from '@/components/reports/glossary-view';

export const metadata: Metadata = { title: 'Glossary' };

export default async function GlossaryPage() {
  await requireAuth();
  return (
    <div className="space-y-6">
      <PageHeader title="Glossary" description="Every term the CRM uses, in plain English. Search a word, or tap the “?” next to it anywhere in the app to land here." />
      <GlossaryView />
    </div>
  );
}

import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { TemplateEditor } from '@/components/admin/template-editor';

export const metadata: Metadata = { title: 'Email Templates' };

export default async function TemplatesPage() {
  await requirePermission('email.template.manage');
  const templates = await prisma.emailTemplate.findMany({ orderBy: { name: 'asc' } });
  return (
    <div>
      <PageHeader title="Email Templates" description="Edit the structured emails the system sends. Use {{placeholders}} for dynamic values." />
      <TemplateEditor templates={templates.map((t) => ({ id: t.id, key: t.key, name: t.name, subject: t.subject, body: t.body, isActive: t.isActive }))} />
    </div>
  );
}

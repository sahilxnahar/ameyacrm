import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { TemplateStudio } from '@/components/admin/template-studio';

export const metadata: Metadata = { title: 'Templates' };
export const dynamic = 'force-dynamic';

export default async function MessageTemplatesPage() {
  await requirePermission('email.template.manage');

  const [rows, whatsapp, departments] = await Promise.all([
    prisma.messageTemplate.findMany({ orderBy: [{ channel: 'asc' }, { name: 'asc' }] }).catch(() => []),
    prisma.integrationConnection.findUnique({ where: { provider: 'whatsapp' } }).catch(() => null),
    prisma.department.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
  ]);

  const templates = rows.map((t) => ({
    id: t.id, key: t.key, name: t.name, channel: t.channel, category: t.category,
    language: t.language, subject: t.subject, header: t.header, body: t.body, footer: t.footer,
    buttons: (t.buttons as Array<{ type: 'QUICK_REPLY' | 'URL'; text: string; url?: string }>) ?? [],
    description: t.description, metaStatus: t.metaStatus, metaRejection: t.metaRejection,
    usageCount: t.usageCount, departmentId: t.departmentId ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Message & ad templates"
        description="Templates you write once and reuse. Give each one a department and only that department will see it on their own Templates page — WhatsApp, email, SMS, letters on your letterhead, and ad copy for Google and Meta. Every one of these is a starting point: edit the wording freely."
      />
      <TemplateStudio templates={templates} departments={departments} whatsappConnected={whatsapp?.status === 'CONNECTED'} />
    </div>
  );
}

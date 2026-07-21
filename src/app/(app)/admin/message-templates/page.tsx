import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { TemplateStudio } from '@/components/admin/template-studio';

export const metadata: Metadata = { title: 'Templates' };
export const dynamic = 'force-dynamic';

export default async function MessageTemplatesPage() {
  await requirePermission('email.template.manage');

  const [rows, whatsapp] = await Promise.all([
    prisma.messageTemplate.findMany({ orderBy: [{ channel: 'asc' }, { name: 'asc' }] }).catch(() => []),
    prisma.integrationConnection.findUnique({ where: { provider: 'whatsapp' } }).catch(() => null),
  ]);

  const templates = rows.map((t) => ({
    id: t.id, key: t.key, name: t.name, channel: t.channel, category: t.category,
    language: t.language, subject: t.subject, header: t.header, body: t.body, footer: t.footer,
    buttons: (t.buttons as Array<{ type: 'QUICK_REPLY' | 'URL'; text: string; url?: string }>) ?? [],
    description: t.description, metaStatus: t.metaStatus, metaRejection: t.metaRejection,
    usageCount: t.usageCount,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="Write a message once and reuse it everywhere — WhatsApp, email, SMS or a letter on your letterhead."
      />
      <TemplateStudio templates={templates} whatsappConnected={whatsapp?.status === 'CONNECTED'} />
    </div>
  );
}

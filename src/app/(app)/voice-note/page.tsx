import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { isGeminiEnabled } from '@/lib/ai/gemini';
import { PageHeader } from '@/components/layout/page-header';
import { VoiceCapture } from '@/components/voice/voice-capture';

export const metadata: Metadata = { title: 'Voice note' };

export default async function VoiceNotePage() {
  await requirePermission('task.create');
  const projects = await prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
  return (
    <div className="max-w-xl">
      <PageHeader title="Site voice note" description="Speak instead of typing — it becomes a site update or a task." />
      <VoiceCapture projects={projects} enabled={isGeminiEnabled()} />
    </div>
  );
}

import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { RemindersView } from '@/components/reminders/reminders-view';
import { ListNotice } from '@/components/ui/list-notice';
import { listWindow, listMeta } from '@/lib/list/page-window';

export const metadata: Metadata = { title: 'Reminders' };

export default async function RemindersPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireAuth();
  const win = listWindow(await searchParams, 200);
  const [rows, reminderTotal] = await Promise.all([
    prisma.reminder.findMany({ where: { userId: user.id }, orderBy: [{ status: 'asc' }, { dueAt: 'asc' }], take: win.take }),
    prisma.reminder.count({ where: { userId: user.id } }),
  ]);
  const leadIds = [...new Set(rows.map((r) => r.leadId).filter(Boolean))] as string[];
  const leads = leadIds.length ? await prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true } }) : [];
  const leadName = new Map(leads.map((l) => [l.id, l.name]));
  return (
    <div className="max-w-3xl">
      <PageHeader title="My reminders" description="Follow-ups and nudges assigned to you." />
      <RemindersView reminders={rows.map((r) => ({ id: r.id, title: r.title, notes: r.notes, dueAt: r.dueAt.toISOString(), status: r.status, leadId: r.leadId, leadName: r.leadId ? leadName.get(r.leadId) ?? null : null }))} />
      <ListNotice meta={listMeta(rows.length, reminderTotal, win)} noun="reminders" />
    </div>
  );
}

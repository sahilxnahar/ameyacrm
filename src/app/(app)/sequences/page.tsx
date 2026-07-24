import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { PageHeader } from '@/components/layout/page-header';
import { SequencesView } from '@/components/sequences/sequences-view';

export const metadata: Metadata = { title: 'Email sequences' };
export const dynamic = 'force-dynamic';

export default async function SequencesPage() {
  const ctx = await requirePermission('lead.view');
  const [sequences, recent, openStats] = await Promise.all([
    prisma.emailSequence.findMany({
      where: { status: { not: 'ARCHIVED' } },
      orderBy: { createdAt: 'desc' },
      include: {
        steps: { orderBy: { ordinal: 'asc' } },
        enrollments: { select: { status: true } },
      },
    }),
    prisma.sequenceEnrollment.findMany({
      orderBy: { enrolledAt: 'desc' }, take: 60,
      include: { sequence: { select: { name: true } } },
    }),
    prisma.mailThreadMessage.aggregate({
      where: { direction: 'OUTBOUND', enrollmentId: { not: null } },
      _count: { _all: true }, _sum: { openCount: true },
    }),
  ]);

  const leadIds = [...new Set(recent.map((r) => r.leadId))];
  const leads = await prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true } });
  const leadName = new Map(leads.map((l) => [l.id, l.name]));
  const opened = await prisma.mailThreadMessage.count({ where: { direction: 'OUTBOUND', enrollmentId: { not: null }, openedAt: { not: null } } });

  return (
    <div>
      <PageHeader
        title="Email sequences"
        description="Follow-up that runs itself and stops the moment someone replies."
      />
      <SequencesView
        canManage={can(ctx.permissions, 'lead.update')}
        emailWorking={env.EMAIL_PROVIDER === 'smtp' || env.EMAIL_PROVIDER === 'ses'}
        sent={openStats._count._all}
        opened={opened}
        sequences={sequences.map((s) => ({
          id: s.id, name: s.name, description: s.description, status: s.status,
          stopOnReply: s.stopOnReply, stopOnStage: s.stopOnStage,
          steps: s.steps.map((t) => ({ id: t.id, ordinal: t.ordinal, dayOffset: t.dayOffset, subject: t.subject, body: t.body })),
          running: s.enrollments.filter((e) => e.status === 'RUNNING').length,
          replied: s.enrollments.filter((e) => e.status === 'REPLIED').length,
          finished: s.enrollments.filter((e) => e.status === 'FINISHED').length,
        }))}
        recent={recent.map((r) => ({
          id: r.id, sequenceName: r.sequence.name, leadName: leadName.get(r.leadId) ?? '—',
          status: r.status, stepsSent: r.stepsSent,
          nextStepAt: r.nextStepAt?.toISOString() ?? null, endReason: r.endReason,
        }))}
      />
    </div>
  );
}

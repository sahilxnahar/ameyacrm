import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { nextReference } from '@/lib/utils/reference';
import { writeAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

const schema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  projectId: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  capturedAt: z.string().optional(),
});

/**
 * Receives a note written while offline.
 *
 * Deliberately a plain POST rather than a server action: the offline queue
 * replays raw fetches from IndexedDB, possibly hours later and from a service
 * worker, where a server action's request context no longer exists.
 */
export async function POST(req: NextRequest) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!can(ctx.permissions, 'task.create')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  try {
    const d = schema.parse(await req.json());
    const reference = await nextReference('TSK');
    const captured = d.capturedAt ? new Date(d.capturedAt) : new Date();

    const task = await prisma.task.create({
      data: {
        reference,
        title: d.title,
        // Keep when it was actually written — it may be hours before it sent.
        description: [d.description, `Written at site on ${captured.toLocaleString('en-IN')}`].filter(Boolean).join('\n\n'),
        priority: d.priority ?? 'MEDIUM',
        status: 'TODO',
        projectId: d.projectId || null,
        createdById: ctx.user.id,
        assignees: { create: [{ userId: ctx.user.id }] },
      },
      select: { id: true, reference: true },
    });

    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Task', entityId: task.id, summary: `Site note ${task.reference} (written offline)` });
    return NextResponse.json({ ok: true, id: task.id, reference: task.reference });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not save the note.' }, { status: 400 });
  }
}

import 'server-only';
import { on } from './bus';
import { notifyDepartment, notifyUsers } from '@/lib/notify/notify';
import { ensureLink } from '@/server/services/links-service';
import { prisma } from '@/lib/db/prisma';
import { wrStatusLabel } from '@/lib/workrequests/lifecycle';

/**
 * Subscribers wire the event backbone to the systems that react. Registered
 * once, via import side-effect from server code that emits (a module-level guard
 * makes re-import a no-op). This is where "a work request notifies the other
 * department" actually happens — the action just emits; this decides who hears it.
 */
let registered = false;

export function registerSubscribers(): void {
  if (registered) return;
  registered = true;

  // A new request → tell the receiving department it has work waiting, and link
  // the request to the record it's about, so both sides show the connection.
  on('workrequest.raised', async (e) => {
    await notifyDepartment(
      e.toDeptId,
      { type: 'SYSTEM', title: `New work request: ${e.title}`, body: e.reference, link: `/work-requests/${e.requestId}` },
      e.actorId,
    );
    if (e.entityType && e.entityId) {
      await ensureLink({ type: 'WorkRequest', id: e.requestId }, { type: e.entityType, id: e.entityId }, 'about', e.actorId);
    }
  });

  // A request moved → tell the person who raised it where it now stands.
  on('workrequest.advanced', async (e) => {
    let raiserId = e.raiserId ?? null;
    if (!raiserId) {
      const wr = await prisma.workRequest.findUnique({ where: { id: e.requestId }, select: { raisedById: true } });
      raiserId = wr?.raisedById ?? null;
    }
    if (raiserId && raiserId !== e.actorId) {
      await notifyUsers([raiserId], {
        type: 'SYSTEM',
        title: `Request ${e.reference}: ${wrStatusLabel(e.toStatus)}`,
        body: e.title,
        link: `/work-requests/${e.requestId}`,
      });
    }
  });
}

// Register on import.
registerSubscribers();

import 'server-only';
import { prisma } from '@/lib/db/prisma';

export interface ApprovalItem {
  stepId: string; entityType: string; title: string; reference: string;
  requester: string; href: string; createdAt: string; sequence: number;
}

/** All approval steps currently awaiting the given user, with human labels. */
export async function getMyPendingApprovals(userId: string): Promise<ApprovalItem[]> {
  const steps = await prisma.approvalStep.findMany({
    where: { approverId: userId, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    include: { request: { include: { requester: { select: { name: true } } } } },
  });
  if (steps.length === 0) return [];

  const mrIds = steps.filter((s) => s.request.entityType === 'MATERIAL_REQUEST').map((s) => s.request.entityId);
  const poIds = steps.filter((s) => s.request.entityType === 'PURCHASE_ORDER').map((s) => s.request.entityId);
  const [mrs, pos] = await Promise.all([
    mrIds.length ? prisma.materialRequest.findMany({ where: { id: { in: mrIds } }, select: { id: true, title: true, reference: true } }) : Promise.resolve([]),
    poIds.length ? prisma.purchaseOrder.findMany({ where: { id: { in: poIds } }, select: { id: true, number: true } }) : Promise.resolve([]),
  ]);
  const mrById = new Map(mrs.map((m) => [m.id, m]));
  const poById = new Map(pos.map((p) => [p.id, p]));

  return steps.map((s): ApprovalItem => {
    const base = { stepId: s.id, entityType: s.request.entityType, requester: s.request.requester.name, createdAt: s.createdAt.toISOString(), sequence: s.sequence };
    if (s.request.entityType === 'MATERIAL_REQUEST') {
      const mr = mrById.get(s.request.entityId);
      return { ...base, title: mr?.title ?? 'Material request', reference: mr?.reference ?? '', href: '/material-requests' };
    }
    if (s.request.entityType === 'PURCHASE_ORDER') {
      const po = poById.get(s.request.entityId);
      return { ...base, title: `Purchase order ${po?.number ?? ''}`, reference: po?.number ?? '', href: '/billing' };
    }
    return { ...base, title: s.request.entityType.replace('_', ' '), reference: s.request.entityId.slice(0, 8), href: '#' };
  });
}

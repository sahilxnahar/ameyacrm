import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { notifyMany } from '@/lib/notifications/notify';

/**
 * The "payments above this need a second pair of eyes" threshold.
 *
 * It lived inside the vendor-payment screen, which meant it only ever guarded
 * ONE of the four ways money leaves this system. An RA-bill settlement, a
 * piece-rate settlement and a recurring payment all wrote themselves straight to
 * POSTED no matter how large — so a ₹40 lakh contractor settlement needed nobody's
 * approval while a ₹6 lakh vendor payment did. The threshold is a company rule,
 * not a screen's rule, so it lives here and every payment path asks it.
 *
 * 0 (the default) means the control is off.
 */
export async function paymentApprovalLimit(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: 'finance.payment_approval_limit' } }).catch(() => null);
  const n = Number(row?.value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** True when this amount must be reviewed before it counts as paid. */
export async function needsPaymentApproval(amount: number): Promise<boolean> {
  const limit = await paymentApprovalLimit();
  return limit > 0 && Number(amount) > limit;
}

/**
 * Who is allowed to approve a payment.
 *
 * Deliberately NOT the permission that lets you raise one: an approval you can
 * grant yourself is not an approval. The requester is always excluded, even if
 * they hold the permission.
 */
export async function paymentApprovers(excludeUserId?: string | null): Promise<{ id: string; name: string }[]> {
  // Narrowed first, then verified.
  //
  // Role alone was wrong — it notified a department head whose approval right
  // had been explicitly DENIED, and never notified somebody granted it by an
  // override. Resolving permissions for every active user was worse: two
  // uncached queries per person, on the inline path of six payment actions.
  // So: the roles that can plausibly hold it, plus anyone granted it directly,
  // and then the permission is actually checked for each.
  const [byRole, byGrant] = await Promise.all([
    prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        role: { in: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'] },
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
    prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        permissionOverrides: { some: { effect: 'ALLOW', permission: { key: 'billing.approve' } } },
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true, name: true, role: true },
      take: 200,
    }).catch(() => []),
  ]);

  const candidates = [...new Map([...byRole, ...byGrant].map((u) => [u.id, u])).values()];
  const { resolvePermissions, can } = await import('@/lib/rbac/can');
  const resolved = await Promise.all(candidates.map(async (u) => {
    try { return can(await resolvePermissions(u), 'billing.approve') ? { id: u.id, name: u.name } : null; }
    catch { return null; }
  }));
  return resolved.filter((x): x is { id: string; name: string } => x !== null);
}

/**
 * Tell the approvers a payment is waiting.
 *
 * Without this the DRAFT sits on a screen nobody has a reason to open, and the
 * threshold turns into a way to lose payments rather than a way to control them.
 * Best-effort: a notification that cannot be sent must never fail the payment.
 */
export async function notifyPaymentApprovers(
  voucherId: string,
  requesterId: string | null,
  summary: string,
): Promise<void> {
  try {
    const approvers = await paymentApprovers(requesterId);
    if (!approvers.length) return;
    await notifyMany(approvers.map((a) => a.id), {
      type: 'APPROVAL',
      title: `Approve payment — ${summary}`,
      link: '/payments?filter=awaiting',
    });
  } catch {
    /* the payment stands; the nudge is a courtesy */
  }
  void voucherId;
}

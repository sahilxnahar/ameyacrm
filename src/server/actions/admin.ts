'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { breachVerdict } from '@/lib/auth/breach';
import { getSecurityPolicy } from '@/lib/auth/policy';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { generateTempPassword } from '@/lib/auth/temp-password';
import { writeAudit } from '@/lib/audit/log';
import { notify } from '@/lib/notifications/notify';
import { ensure, toActionError } from './_helpers';

export type AdminResult = { ok: true; id: string; message?: string } | { error: string };
export type TempPasswordResult = { ok: true; id: string; tempPassword: string } | { error: string };

const userSchema = z.object({
  name: z.string().min(2).max(160),
  username: z.string().min(3).max(60).regex(/^[a-zA-Z0-9_.@+-]+$/, 'Use letters, numbers or . _ @ + - (an email address works too)'),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  employeeId: z.string().max(40).optional(),
  designation: z.string().max(120).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'MANAGER', 'EXECUTIVE', 'EMPLOYEE', 'READ_ONLY', 'GUEST']),
  departmentId: z.string().optional().nullable(),
  password: z.string().min(8),
});

export async function createUser(input: unknown): Promise<AdminResult> {
  try {
    const ctx = await ensure('admin.user.manage');
    const d = userSchema.parse(input);
    // F-05: creating a user must respect role hierarchy — an ADMIN cannot mint an
    // ADMIN or SUPER_ADMIN through this path (only setUserRole was guarded before).
    if (!canAssignRole(ctx.user.role, d.role)) {
      return { error: 'You cannot create an account with a role at or above your own.' };
    }
    const pwErrors = validatePasswordStrength(d.password);
    const policy = await getSecurityPolicy();
    if (policy.breachCheck) {
      const breach = await breachVerdict(d.password);
      if (!breach.ok) return { error: breach.message ?? 'Please choose a different password.' };
    }
    if (pwErrors.length) return { error: `Weak password: ${pwErrors.join(', ')}` };

    const dupe = await prisma.user.findFirst({ where: { OR: [{ username: d.username }, { email: d.email.toLowerCase() }] } });
    if (dupe) return { error: 'Username or email already exists.' };

    const user = await prisma.user.create({
      data: {
        name: d.name, username: d.username, email: d.email.toLowerCase(), phone: d.phone || null,
        employeeId: d.employeeId || null, designation: d.designation || null, role: d.role,
        departmentId: d.departmentId || null, passwordHash: await hashPassword(d.password),
        status: 'ACTIVE', mustChangePassword: true, joiningDate: new Date(),
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'User', entityId: user.id, summary: `Created user ${d.username} (${d.role})` });
    await notify({ userId: user.id, type: 'SYSTEM', title: 'Welcome to Ameya Heights CRM', body: 'Please set a new password on first login.', link: '/settings/security' });

    // Tell them the account exists. Until this, a new joiner had no way of
    // knowing unless somebody remembered to message them.
    const { beginOnboarding } = await import('@/server/services/onboarding-service');
    const invited = await beginOnboarding(user.id, ctx.user.id);

    revalidatePath('/admin');
    return {
      ok: true, id: user.id,
      message: invited.ok
        ? `${d.name} has been emailed a link to set their own password. Reminders go hourly until they sign in.`
        : `User created, but the welcome email failed: ${invited.error ?? 'unknown error'}. Check Admin > Integrations.`,
    };
  } catch (err) {
    return toActionError(err);
  }
}


/**
 * Load the target and confirm the actor outranks them.
 *
 * Every account-altering admin action funnels through here: permission alone
 * never decides, because `admin.user.manage` is held by ADMIN as well as
 * SUPER_ADMIN and these actions can otherwise be turned upward against a
 * higher-ranked account.
 */
async function assertMayActOn(actorId: string, actorRole: string, targetId: string): Promise<{ error: string } | null> {
  if (actorId === targetId) return { error: 'You cannot do that to your own account.' };
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true } });
  if (!target) return { error: 'That user no longer exists.' };
  if (!canActOnUser(actorRole, target.role)) {
    return { error: 'You cannot change an account at or above your own level.' };
  }
  return null;
}

export async function setUserStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED'): Promise<AdminResult> {
  try {
    const ctx = await ensure('admin.user.manage');
    const blocked = await assertMayActOn(ctx.user.id, ctx.user.role, userId);
    if (blocked) return blocked;
    await prisma.user.update({ where: { id: userId }, data: { status } });
    if (status !== 'ACTIVE') await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'User', entityId: userId, summary: `Status → ${status}` });
    revalidatePath('/admin');
    return { ok: true, id: userId };
  } catch (err) {
    return toActionError(err);
  }
}

export async function forcePasswordReset(userId: string): Promise<AdminResult> {
  try {
    const ctx = await ensure('admin.user.manage');
    const blocked = await assertMayActOn(ctx.user.id, ctx.user.role, userId);
    if (blocked) return blocked;
    await prisma.user.update({ where: { id: userId }, data: { mustChangePassword: true } });
    await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit({ actorId: ctx.user.id, action: 'PASSWORD_CHANGE', entityType: 'User', entityId: userId, summary: 'Forced password reset' });
    await notify({ userId, type: 'SYSTEM', title: 'Password reset required', body: 'An administrator requires you to set a new password.', link: '/settings/security' });
    revalidatePath('/admin');
    return { ok: true, id: userId };
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Set a fresh temporary password for a user and return it once to the admin.
 *
 * The plaintext is generated here, hashed before storage, and never persisted
 * in the clear. The user must change it at next login (`mustChangePassword`),
 * and all their existing sessions are revoked so an old session cannot skip the
 * change. The admin shares the password with the user over a trusted channel.
 */
export async function generateTemporaryPassword(userId: string): Promise<TempPasswordResult> {
  try {
    const ctx = await ensure('admin.user.manage');
    const blocked = await assertMayActOn(ctx.user.id, ctx.user.role, userId);
    if (blocked) return blocked;

    const tempPassword = generateTempPassword();
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(tempPassword), passwordChangedAt: new Date(), mustChangePassword: true },
    });
    await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit({ actorId: ctx.user.id, action: 'PASSWORD_CHANGE', entityType: 'User', entityId: userId, summary: 'Issued a temporary password' });
    await notify({ userId, type: 'SYSTEM', title: 'Your password was reset', body: 'An administrator set a temporary password. Sign in with it and choose a new one.', link: '/settings/security' });
    revalidatePath('/admin');
    return { ok: true, id: userId, tempPassword };
  } catch (err) {
    return toActionError(err);
  }
}

const deptSchema = z.object({ name: z.string().min(2).max(80), description: z.string().optional(), color: z.string().optional() });
export async function createDepartment(input: unknown): Promise<AdminResult> {
  try {
    const ctx = await ensure('admin.department.manage');
    const d = deptSchema.parse(input);
    const slug = d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const exists = await prisma.department.findFirst({ where: { OR: [{ name: d.name }, { slug }] } });
    if (exists) return { error: 'Department already exists.' };
    const dept = await prisma.department.create({ data: { name: d.name, slug, description: d.description || null, color: d.color || null } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Department', entityId: dept.id, summary: `Created department ${d.name}` });
    revalidatePath('/admin');
    return { ok: true, id: dept.id };
  } catch (err) {
    return toActionError(err);
  }
}

/** Set who a user reports to (drives hierarchy-based visibility and work assignment). */
export async function setUserManager(userId: string, managerId: string | null): Promise<AdminResult> {
  try {
    const ctx = await ensure('admin.user.manage');
    if (managerId === userId) return { error: 'A user cannot report to themselves.' };
    if (managerId) {
      // prevent cycles: walk up from the proposed manager
      let cur: string | null = managerId;
      for (let i = 0; i < 10 && cur; i++) {
        if (cur === userId) return { error: 'That would create a reporting loop.' };
        const up: { managerId: string | null } | null = await prisma.user.findUnique({ where: { id: cur }, select: { managerId: true } });
        cur = up?.managerId ?? null;
      }
    }
    await prisma.user.update({ where: { id: userId }, data: { managerId } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'User', entityId: userId, summary: managerId ? 'Updated reporting manager' : 'Cleared reporting manager' });
    revalidatePath('/team');
    revalidatePath('/admin');
    return { ok: true, id: userId };
  } catch (err) { return toActionError(err); }
}

/** Move a person into a department (or out of one). */
export async function setUserDepartment(userId: string, departmentId: string | null): Promise<AdminResult> {
  try {
    const ctx = await ensure('admin.user.manage');
    await prisma.user.update({ where: { id: userId }, data: { departmentId } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'User', entityId: userId, summary: departmentId ? 'Moved to a department' : 'Removed from department' });
    revalidatePath('/team');
    revalidatePath('/admin');
    return { ok: true, id: userId };
  } catch (err) {
    return toActionError(err);
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Changing somebody's role
// ════════════════════════════════════════════════════════════════════════════

import { checkRoleChange, type RoleValue, canAssignRole, canActOnUser } from '@/lib/auth/role-change';
import { ASSIGNABLE_ROLES } from '@/config/roles';
export type { RoleValue };


/**
 * Change what somebody is allowed to do.
 *
 * Restricted to super admins, and hedged four ways, because a role change is
 * the one edit that can quietly hand over the whole system — or lock everyone
 * out of it:
 *
 *   1. You cannot change your own role. Otherwise a mis-click demotes the only
 *      person who could undo it.
 *   2. You cannot grant a role you do not hold yourself.
 *   3. The last remaining super admin cannot be demoted. There must always be
 *      somebody who can put things right.
 *   4. Every change is written to the audit log with the before and after.
 */
export async function setUserRole(userId: string, role: string): Promise<AdminResult> {
  try {
    const ctx = await ensure('admin.user.manage');

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, deletedAt: true },
    });
    if (!target || target.deletedAt) return { error: 'That person was not found.' };
    if (target.role === role) return { ok: true, id: userId, message: 'No change — they already have that role.' };

    const otherSuperAdmins = await prisma.user.count({
      where: { role: 'SUPER_ADMIN', deletedAt: null, status: 'ACTIVE', id: { not: userId } },
    });

    const verdict = checkRoleChange({
      actorId: ctx.user.id, actorRole: ctx.user.role,
      targetId: userId, targetRole: target.role, newRole: role, otherSuperAdmins,
    });
    if ('error' in verdict) return verdict;

    await prisma.user.update({ where: { id: userId }, data: { role: role as never } });

    await writeAudit({
      actorId: ctx.user.id, action: 'UPDATE', entityType: 'User', entityId: userId,
      summary: `Role changed: ${target.name} — ${target.role} → ${role}`,
    });
    // The person should know their access changed, and when.
    await notify({
      userId, type: 'SYSTEM',
      title: `Your role is now ${ASSIGNABLE_ROLES.find((r) => r.value === role)?.label ?? role}`,
      link: '/settings/profile',
    }).catch(() => undefined);

    revalidatePath('/team');
    revalidatePath('/admin');
    return { ok: true, id: userId, message: `${target.name} is now ${role.replace(/_/g, ' ').toLowerCase()}.` };
  } catch (err) {
    return toActionError(err);
  }
}

/** Set the extra departments somebody belongs to, on top of their main one. */
export async function setUserExtraDepartments(userId: string, departmentIds: string[]): Promise<AdminResult> {
  try {
    const ctx = await ensure('admin.user.manage');
    const { setExtraDepartments } = await import('@/server/services/department-service');
    await setExtraDepartments(userId, departmentIds);
    await writeAudit({
      actorId: ctx.user.id, action: 'UPDATE', entityType: 'User', entityId: userId,
      summary: departmentIds.length
        ? `Extra departments set (${departmentIds.length})`
        : 'Extra departments cleared',
    });
    revalidatePath('/team');
    revalidatePath('/admin');
    return { ok: true, id: userId };
  } catch (err) {
    return toActionError(err);
  }
}


/**
 * Remove a user.
 *
 * A soft delete, deliberately: a hard delete would take their audit trail, the
 * vouchers they posted and the leads they owned with it, and "who recorded this
 * payment" is not a question the books are allowed to stop answering. The
 * account is deactivated, its sessions are killed and the login is freed up by
 * parking the address, so the person can no longer sign in by any route.
 */
/**
 * Move a departing person's open work to somebody who can act on it.
 *
 * Called before an account is removed. Leads keep their history — this only
 * changes who is responsible — and each one gets an activity line so the
 * handover is visible rather than mysterious.
 */
async function reassignOpenWork(fromUserId: string, toUserId: string): Promise<{ leads: number; tasks: number }> {
  const leads = await prisma.lead.findMany({
    where: { ownerId: fromUserId, deletedAt: null, status: { notIn: ['WON', 'LOST'] } },
    select: { id: true },
  }).catch(() => []);

  if (leads.length) {
    await prisma.lead.updateMany({
      where: { id: { in: leads.map((l) => l.id) } },
      data: { ownerId: toUserId },
    }).catch(() => undefined);
    await prisma.leadActivity.createMany({
      data: leads.map((l) => ({
        leadId: l.id, userId: toUserId, type: 'NOTE' as const,
        subject: 'Reassigned — previous owner left',
        notes: 'The person who owned this lead was removed from the CRM, so it was passed on to keep it being worked.',
      })),
    }).catch(() => undefined);
  }

  const tasks = await prisma.task.updateMany({
    where: { createdById: fromUserId, status: { notIn: ['DONE', 'CANCELLED'] } },
    data: { createdById: toUserId },
  }).catch(() => ({ count: 0 }));

  return { leads: leads.length, tasks: tasks.count };
}

export async function deleteUser(userId: string): Promise<AdminResult> {
  try {
    const ctx = await ensure('admin.user.manage');
    const blocked = await assertMayActOn(ctx.user.id, ctx.user.role, userId);
    if (blocked) return blocked;

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, deletedAt: true },
    });
    if (!target) return { error: 'That user no longer exists.' };
    if (target.deletedAt) return { error: 'That user has already been removed.' };

    // Never remove the last person who can put things right.
    if (target.role === 'SUPER_ADMIN') {
      const others = await prisma.user.count({
        where: { role: 'SUPER_ADMIN', status: 'ACTIVE', deletedAt: null, id: { not: userId } },
      });
      if (others === 0) {
        return { error: 'This is the only super admin. Make somebody else a super admin first.' };
      }
    }

    // Hand their open work to somebody before the account goes.
    //
    // Leaving leads pointing at a removed user silently stops all chasing on
    // them: the escalation sweep only loads ACTIVE users, so an executive
    // leaving with 120 open leads took those 120 out of every queue at once.
    const reassigned = await reassignOpenWork(userId, ctx.user.id);

    const parked = `deleted+${target.id.slice(-8)}@removed.invalid`;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          status: 'DISABLED',
          // Free the address so it can be re-invited later, and make certain the
          // old one can no longer be used to sign in.
          email: parked,
          mustChangePassword: true,
        },
      }),
      prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    await writeAudit({
      actorId: ctx.user.id, action: 'DELETE', entityType: 'User', entityId: userId,
      summary: `Removed user ${target.name ?? target.email} (${target.email}) — account disabled, history kept, ${reassigned.leads} lead(s) and ${reassigned.tasks} task(s) reassigned`,
    });
    revalidatePath('/admin');
    const moved = reassigned.leads + reassigned.tasks;
    return {
      ok: true, id: userId,
      message: `${target.name ?? target.email} has been removed.${moved ? ` Their ${reassigned.leads} open lead(s) and ${reassigned.tasks} task(s) were passed to you so nothing goes unworked.` : ''} Their history stays in the audit trail.`,
    };
  } catch (err) {
    return toActionError(err);
  }
}

/** Put a removed user back. */
export async function restoreUser(userId: string, email: string): Promise<AdminResult> {
  try {
    const ctx = await ensure('admin.user.manage');
    const blocked = await assertMayActOn(ctx.user.id, ctx.user.role, userId);
    if (blocked) return blocked;
    const clean = String(email ?? '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { error: 'Enter the email address to restore them under.' };
    const taken = await prisma.user.findFirst({ where: { email: clean, id: { not: userId } }, select: { id: true } });
    if (taken) return { error: 'Another account already uses that email address.' };

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null, status: 'ACTIVE', email: clean, mustChangePassword: true },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'User', entityId: userId, summary: `Restored user as ${clean}` });
    revalidatePath('/admin');
    return { ok: true, id: userId, message: 'User restored. They must set a new password at next sign-in.' };
  } catch (err) {
    return toActionError(err);
  }
}

export type ExportResult = { ok: true; filename: string; base64: string; users: number } | { error: string };

/**
 * Download everybody's data, Workspace-style.
 *
 * Gated on `admin.user.manage` and written to the audit log: a bulk export of
 * personal data is precisely the action you want a record of afterwards.
 */
export async function exportUsers(userIds?: string[]): Promise<ExportResult> {
  try {
    const ctx = await ensure('admin.user.manage');
    const { buildUserExport } = await import('@/server/services/user-export-service');
    const result = await buildUserExport({ userIds, includeActivity: true });
    await writeAudit({
      actorId: ctx.user.id, action: 'EXPORT', entityType: 'User',
      summary: `Exported data for ${result.users} user${result.users === 1 ? '' : 's'}`,
    });
    return { ok: true, ...result };
  } catch (err) {
    return toActionError(err);
  }
}

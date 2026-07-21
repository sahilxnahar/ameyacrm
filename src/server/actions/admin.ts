'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { breachVerdict } from '@/lib/auth/breach';
import { getSecurityPolicy } from '@/lib/auth/policy';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { writeAudit } from '@/lib/audit/log';
import { notify } from '@/lib/notifications/notify';
import { ensure, toActionError } from './_helpers';

export type AdminResult = { ok: true; id: string; message?: string } | { error: string };

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

export async function setUserStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED'): Promise<AdminResult> {
  try {
    const ctx = await ensure('admin.user.manage');
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

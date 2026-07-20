'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { ONBOARDING } from '@/config/onboarding';

export async function completeStep(stepKey: string): Promise<{ ok: true } | { error: string }> {
  try {
    const ctx = await ensure('dashboard.view');
    await prisma.onboardingStep.upsert({
      where: { userId_stepKey: { userId: ctx.user.id, stepKey } },
      update: { completedAt: new Date() },
      create: { userId: ctx.user.id, stepKey, completedAt: new Date() },
    });
    revalidatePath('/today');
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function reopenStep(stepKey: string): Promise<{ ok: true } | { error: string }> {
  try {
    const ctx = await ensure('dashboard.view');
    await prisma.onboardingStep.updateMany({ where: { userId: ctx.user.id, stepKey }, data: { completedAt: null } });
    revalidatePath('/today');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Dismiss the whole thing — some people just want it gone. */
export async function dismissOnboarding(): Promise<{ ok: true } | { error: string }> {
  try {
    const ctx = await ensure('dashboard.view');
    for (const s of ONBOARDING) {
      await prisma.onboardingStep.upsert({
        where: { userId_stepKey: { userId: ctx.user.id, stepKey: s.key } },
        update: { completedAt: new Date() },
        create: { userId: ctx.user.id, stepKey: s.key, completedAt: new Date() },
      });
    }
    revalidatePath('/today');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

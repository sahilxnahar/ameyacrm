'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { STARTER_AUTOMATIONS } from '@/config/starter-automations';

export type InstallResult = { ok: true; installed: number; skipped: number; message: string } | { error: string };

/**
 * Install ready-made automations. They arrive switched OFF so nothing starts
 * acting on real records until it has been read and enabled deliberately.
 */
export async function installStarterAutomations(keys: string[]): Promise<InstallResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const wanted = STARTER_AUTOMATIONS.filter((a) => keys.includes(a.key));
    if (!wanted.length) return { error: 'Nothing was selected.' };

    let installed = 0;
    let skipped = 0;
    for (const a of wanted) {
      const exists = await prisma.automationRule.findFirst({ where: { name: a.name }, select: { id: true } });
      if (exists) { skipped++; continue; }
      await prisma.automationRule.create({
        data: {
          name: a.name,
          description: `${a.what} — ${a.department}`,
          trigger: a.trigger,
          isActive: false, // deliberately off until reviewed
          matchAll: a.matchAll ?? true,
          conditions: (a.conditions ?? []) as object,
          actions: a.actions as object,
          elseActions: a.elseActions ? (a.elseActions as object) : undefined,
          slaMinutes: a.slaMinutes ?? null,
          createdById: ctx.user.id,
        },
      });
      installed++;
    }

    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'AutomationRule', summary: `Installed ${installed} starter automations` });
    revalidatePath('/admin/automations');
    return {
      ok: true, installed, skipped,
      message: installed === 0
        ? 'Those are already in your list.'
        : `${installed} added${skipped ? `, ${skipped} were already there` : ''}. They are switched off — open each one, read it, then turn it on.`,
    };
  } catch (e) {
    return toActionError(e);
  }
}

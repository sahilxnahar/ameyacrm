import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { nextReference } from '@/lib/utils/reference';
import { readMyAutomationPrefs } from '@/lib/automation/my-prefs';
import { STARTER_AUTOMATIONS } from '@/config/starter-automations';

/**
 * Personal ("My Automations") execution.
 *
 * The shared automation engine (src/lib/automation/engine.ts) reacts to real
 * events — a lead arriving, a task changing status — for org-wide rules an admin
 * built. This service is the other half: the per-user schedule automations a
 * person switches on for *themselves* on the My Automations page. Those are
 * stored on User.automationPrefs and nobody else's account is touched.
 *
 * Scope is deliberately narrow and safe: we only act on automations whose
 * trigger is SCHEDULE and whose actions include CREATE_TASK. For each of those
 * a person has switched on, we raise one dated task assigned to them per day.
 * Event-driven personal automations (LEAD_CREATED etc.) are intentionally left
 * to the org engine — running them per-user here would double-fire.
 *
 * Idempotency: each generated task carries a hidden marker in its description
 * ("[my-automation:<key>]"). Before creating, we check whether a task with that
 * exact marker, assigned to that person, already exists since the start of the
 * day. So re-running the daily cron (or a retry) never produces duplicates.
 */

const BY_KEY = new Map(STARTER_AUTOMATIONS.map((a) => [a.key, a]));

function markerFor(key: string): string {
  return `[my-automation:${key}]`;
}

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
const VALID_PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export async function runPersonalAutomations(now: Date): Promise<{ users: number; tasksCreated: number; skipped: number }> {
  let users: Array<{ id: string; automationPrefs: unknown }>;
  try {
    users = await prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, automationPrefs: true },
    });
  } catch {
    return { users: 0, tasksCreated: 0, skipped: 0 };
  }

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let tasksCreated = 0;
  let skipped = 0;
  let usersWithPrefs = 0;

  for (const u of users) {
    const prefs = readMyAutomationPrefs(u.automationPrefs);
    const enabledKeys = Object.keys(prefs).filter((k) => prefs[k]?.on === true);
    if (enabledKeys.length === 0) continue;
    usersWithPrefs++;

    for (const key of enabledKeys) {
      const auto = BY_KEY.get(key);
      if (!auto) continue;
      // Only per-user schedule automations run here; event ones are org-engine's job.
      if (auto.trigger !== 'SCHEDULE') continue;
      const createAction = auto.actions.find((a) => a.type === 'CREATE_TASK');
      if (!createAction) continue;

      const pref = prefs[key]!;
      const marker = markerFor(key);

      // Already raised for this person today? Then skip — keeps retries clean.
      try {
        const existing = await prisma.task.findFirst({
          where: {
            deletedAt: null,
            createdAt: { gte: startOfDay },
            description: { startsWith: marker },
            assignees: { some: { userId: u.id } },
          },
          select: { id: true },
        });
        if (existing) { skipped++; continue; }
      } catch {
        // If the query fails (e.g. table not migrated), don't risk a duplicate.
        continue;
      }

      const p = createAction.params ?? {};
      const title = (typeof p.title === 'string' && p.title) || auto.name;
      const dueInDays = Number(pref.dueInDays ?? p.dueInDays ?? 0);
      const rawPriority = String(pref.priority ?? p.priority ?? 'MEDIUM').toUpperCase();
      const priority = (VALID_PRIORITIES.includes(rawPriority as Priority) ? rawPriority : 'MEDIUM') as Priority;

      try {
        const reference = await nextReference('TSK');
        await prisma.task.create({
          data: {
            reference,
            title,
            description: `${marker} ${auto.what}`.trim(),
            status: 'TODO',
            priority: priority as never,
            createdById: u.id,
            dueDate: dueInDays > 0 ? new Date(now.getTime() + dueInDays * 864e5) : null,
            assignees: { create: [{ userId: u.id }] },
          },
        });
        tasksCreated++;
      } catch {
        // A single failure (bad ref race, etc.) must not stop the rest.
      }
    }
  }

  return { users: usersWithPrefs, tasksCreated, skipped };
}

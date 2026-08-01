import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { notify } from '@/lib/notifications/notify';
import { sendEmail, renderTemplate } from '@/lib/email/email';
import { nextReference } from '@/lib/utils/reference';
import { dispatchWebhookEvent } from '@/lib/webhooks/dispatch';
import { dispatchConnectorEvent } from '@/server/services/connector-runtime';
import { TRIGGER_TO_EVENT } from '@/lib/webhooks/events';

export type AutoTrigger = 'LEAD_CREATED' | 'LEAD_STAGE_CHANGED' | 'TASK_CREATED' | 'TASK_STATUS_CHANGED' | 'SCHEDULE';
export interface Condition { field: string; op: string; value: string | number | boolean | Array<string | number> }
export interface Action { type: string; params: Record<string, unknown> }
export interface RunContext { entityType: string; entityId: string; data: Record<string, unknown>; actorId?: string }

function evalCondition(data: Record<string, unknown>, c: Condition): boolean {
  const actual = data[c.field];
  const raw = c.value ?? '';
  const v = String(raw);
  const list = Array.isArray(raw) ? raw.map((x) => String(x)) : String(raw).split(',').map((x) => x.trim());

  switch (c.op) {
    case 'eq': return String(actual ?? '') === v;
    case 'neq': return String(actual ?? '') !== v;
    case 'contains': return String(actual ?? '').toLowerCase().includes(v.toLowerCase());
    case 'not_contains': return !String(actual ?? '').toLowerCase().includes(v.toLowerCase());
    case 'gt': return Number(actual) > Number(raw);
    case 'gte': return Number(actual) >= Number(raw);
    case 'lt': return Number(actual) < Number(raw);
    case 'lte': return Number(actual) <= Number(raw);
    case 'in': return list.includes(String(actual ?? ''));
    case 'not_in': return !list.includes(String(actual ?? ''));
    case 'is_set': return actual !== null && actual !== undefined && String(actual) !== '';
    case 'is_empty': return actual === null || actual === undefined || String(actual) === '';
    case 'is_true': return Boolean(actual) === true;
    case 'is_false': return Boolean(actual) === false;
    default: return false;
  }
}

/**
 * Run every active rule for a trigger against an entity. Lead-focused today.
 * No-ops silently if the automation tables haven't been migrated yet.
 */
export async function runAutomations(trigger: AutoTrigger, ctx: RunContext): Promise<void> {
  // Fire any outbound webhooks subscribed to this event, alongside the rules.
  // Non-blocking and isolated: a webhook problem never affects automations.
  const event = TRIGGER_TO_EVENT[trigger];
  if (event) {
    const eventData = { entityType: ctx.entityType, entityId: ctx.entityId, ...ctx.data };
    void dispatchWebhookEvent(event, eventData).catch(() => undefined);
    void dispatchConnectorEvent(event, eventData).catch(() => undefined);
  }

  let rules;
  try {
    rules = await prisma.automationRule.findMany({ where: { trigger, isActive: true } });
  } catch {
    return; // AutomationRule table not present yet
  }
  for (const rule of rules) {
    try {
      const conditions = (rule.conditions as Condition[] | null) ?? [];
      // matchAll decides whether every condition must hold, or just one.
      const matchAll = (rule as { matchAll?: boolean }).matchAll !== false;
      const passed = conditions.length === 0
        ? true
        : matchAll
          ? conditions.every((c) => evalCondition(ctx.data, c))
          : conditions.some((c) => evalCondition(ctx.data, c));

      const elseActions = ((rule as { elseActions?: unknown }).elseActions as Action[] | null) ?? [];
      if (!passed && elseActions.length === 0) {
        await logRun(rule.id, ctx, 'SKIPPED', { reason: 'conditions not met' });
        continue;
      }

      const actions = passed
        ? ((rule.actions as Action[] | null) ?? [])
        : elseActions;
      // Every action runs even if an earlier one could not do its job — a rule
      // that cannot assign should still create the follow-up task. Any action
      // reporting FAILED marks the whole run FAILED so it is visible on the
      // automation log rather than being recorded as a success.
      const results: string[] = [];
      for (const a of actions) {
        try {
          results.push(await executeAction(a, rule, ctx));
        } catch (err) {
          results.push(`FAILED: ${a.type} — ${err instanceof Error ? err.message : 'error'}`);
        }
      }
      const anyFailed = results.some((r) => r.startsWith('FAILED:'));
      await prisma.automationRule.update({ where: { id: rule.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } });
      await logRun(rule.id, ctx, anyFailed ? 'FAILED' : 'SUCCESS', { branch: passed ? 'then' : 'else', actions: results });
    } catch (err) {
      await logRun(rule.id, ctx, 'FAILED', { error: err instanceof Error ? err.message : 'error' });
    }
  }
}

async function logRun(ruleId: string, ctx: RunContext, status: string, detail: Record<string, unknown>) {
  await prisma.automationRun.create({ data: { ruleId, entityType: ctx.entityType, entityId: ctx.entityId, status, detail: detail as never } }).catch(() => undefined);
}

async function systemCreatorId(rule: { createdById: string | null }, ctx: RunContext): Promise<string | null> {
  if (rule.createdById) return rule.createdById;
  if (ctx.actorId) return ctx.actorId;
  const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } });
  return admin?.id ?? null;
}

async function executeAction(a: Action, rule: { id: string; name: string; runCount: number; createdById: string | null }, ctx: RunContext): Promise<string> {
  const p = a.params ?? {};
  const leadLink = ctx.entityType === 'Lead' ? `/sales/${ctx.entityId}` : undefined;

  switch (a.type) {
    case 'ASSIGN_ROUND_ROBIN': {
      // Accepts an explicit list of people OR a role. The shipped starter rule
      // ("share out every new enquiry") passes a role, which this used to
      // ignore — so it silently assigned nobody, logged SUCCESS, and every
      // captured lead sat unowned and invisible to the reps.
      let ids = (p.userIds as string[] | undefined)?.filter(Boolean) ?? [];
      if (!ids.length && typeof p.role === 'string') {
        const people = await prisma.user.findMany({
          where: { role: p.role as never, status: 'ACTIVE', deletedAt: null },
          select: { id: true }, orderBy: { createdAt: 'asc' },
        }).catch(() => []);
        ids = people.map((u) => u.id);
      }
      // Only people who can actually act on it.
      if (ids.length) {
        const active = await prisma.user.findMany({
          where: { id: { in: ids }, status: 'ACTIVE', deletedAt: null }, select: { id: true },
        }).catch(() => []);
        ids = active.map((u) => u.id);
      }
      if (!ids.length) {
        // Cannot assign. Two things must happen, and neither used to:
        // the run is marked FAILED (see the FAILED: prefix handling below) so
        // it shows up on the automation log, and a human is told — otherwise
        // the lead simply sits unowned, invisible to every rep.
        const managers = await prisma.user.findMany({
          where: { status: 'ACTIVE', deletedAt: null, role: { in: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'MANAGER'] } },
          select: { id: true }, take: 10,
        }).catch(() => []);
        for (const m of managers) {
          await notify({
            userId: m.id, type: 'SYSTEM',
            title: 'A new enquiry could not be assigned to anybody',
            body: typeof p.role === 'string'
              ? `The rule "${rule.name}" shares leads out among people with the role ${String(p.role)}, and nobody active holds it. The lead is unowned — please assign it.`
              : `The rule "${rule.name}" has no people configured. The lead is unowned — please assign it.`,
            link: leadLink,
          }).catch(() => undefined);
        }
        return `FAILED: assign — ${typeof p.role === 'string' ? `nobody active has the role "${String(p.role)}"` : 'no users configured'}`;
      }
      const pick = ids[rule.runCount % ids.length]!;
      if (ctx.entityType === 'Lead') await prisma.lead.update({ where: { id: ctx.entityId }, data: { ownerId: pick } });
      await notify({ userId: pick, type: 'SYSTEM', title: `New lead assigned: ${String(ctx.data.name ?? '')}`, link: leadLink });
      return `assigned (round-robin) to ${pick}`;
    }
    case 'ASSIGN_USER': {
      const uid = p.userId as string;
      if (!uid) return 'assign: no user';
      if (ctx.entityType === 'Lead') await prisma.lead.update({ where: { id: ctx.entityId }, data: { ownerId: uid } });
      await notify({ userId: uid, type: 'SYSTEM', title: `Assigned: ${String(ctx.data.name ?? '')}`, link: leadLink });
      return `assigned to ${uid}`;
    }
    case 'NOTIFY_ROLE': {
      // Tell everyone holding a role — "a manager should see this", without
      // naming a person who might leave.
      const role = (p.role as string) || 'MANAGER';
      const above: Record<string, string[]> = {
        MANAGER: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'MANAGER'],
        ADMIN: ['SUPER_ADMIN', 'ADMIN'],
        DEPARTMENT_HEAD: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'],
      };
      const roles = above[role] ?? [role];
      const people = await prisma.user.findMany({
        where: { status: 'ACTIVE', deletedAt: null, role: { in: roles as never } },
        select: { id: true },
      });
      if (!people.length) return `notify role ${role}: nobody holds it`;
      for (const u of people) {
        await notify({ userId: u.id, type: 'SYSTEM', title: (p.title as string) || `Automation: ${rule.name}`, link: leadLink });
      }
      return `notified ${people.length} × ${role}`;
    }
    case 'NOTIFY_USER': {
      const uid = p.userId as string;
      if (!uid) return 'notify: no user';
      await notify({ userId: uid, type: 'SYSTEM', title: (p.title as string) || `Automation: ${rule.name}`, link: leadLink });
      return `notified ${uid}`;
    }
    case 'UPDATE_LEAD_STATUS': {
      const status = p.status as string;
      if (status && ctx.entityType === 'Lead') await prisma.lead.update({ where: { id: ctx.entityId }, data: { status: status as never } });
      return `status → ${status}`;
    }
    case 'CREATE_TASK': {
      const creator = await systemCreatorId(rule, ctx);
      if (!creator) return 'create task: no creator';
      const reference = await nextReference('TSK');
      const dueInDays = Number(p.dueInDays ?? 0);
      await prisma.task.create({
        data: {
          reference, title: (p.title as string) || `Follow up: ${String(ctx.data.name ?? '')}`,
          status: 'TODO', priority: (p.priority as never) || ('HIGH' as never), createdById: creator,
          dueDate: dueInDays ? new Date(Date.now() + dueInDays * 864e5) : null,
          assignees: p.assigneeId ? { create: [{ userId: p.assigneeId as string }] } : undefined,
        },
      });
      return 'task created';
    }
    case 'SEND_EMAIL_TEMPLATE': {
      const key = p.templateKey as string;
      const to = (p.to as string) === 'lead' ? (ctx.data.email as string) : (p.to as string);
      if (!key || !to) return 'email: missing template/recipient';
      const tpl = await prisma.emailTemplate.findUnique({ where: { key } });
      if (!tpl) return `email: template ${key} not found`;
      const vars = Object.fromEntries(Object.entries(ctx.data).map(([k, v]) => [k, String(v ?? '')]));
      await sendEmail({ to: [to], subject: renderTemplate(tpl.subject, vars), text: renderTemplate(tpl.body, vars) });
      return `email sent to ${to}`;
    }
    default:
      return `unknown action ${a.type}`;
  }
}

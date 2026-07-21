import {
  AUTOMATION_ACTIONS, TRIGGER_VALUES, ACTION_TYPES, OPERATOR_VALUES, fieldsForTrigger,
} from '@/config/automation-capabilities';

export interface DraftAutomation {
  name: string;
  description: string;
  trigger: string;
  matchAll: boolean;
  conditions: Array<{ field: string; op: string; value?: string }>;
  actions: Array<{ type: string; params: Record<string, unknown> }>;
  /** The starter template it was based on, if any. */
  basedOn?: string;
  /** Things we corrected or could not honour, told plainly. */
  notes: string[];
}

/**
 * Keep only what the engine can really run.
 *
 * This is the part that matters. An AI will happily invent SEND_WHATSAPP or a
 * `paymentAmount` field, and the result saves without complaint, shows as
 * active, and then does nothing whatsoever — because the engine falls through
 * to "unknown action" without raising anything. So rather than trusting the
 * model, every trigger, field, operator and action is checked against the
 * capability list, and anything that fails is dropped and reported.
 */
export function sanitise(raw: unknown): DraftAutomation | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'The AI did not return an automation.' };
  const r = raw as Record<string, unknown>;
  const notes: string[] = [];

  const trigger = String(r.trigger ?? '');
  if (!TRIGGER_VALUES.includes(trigger)) {
    return { error: `The AI chose a trigger this system does not have ("${trigger || 'none'}"). Try describing when it should happen more plainly — for example "when a new enquiry arrives" or "once a day".` };
  }

  const allowedFields = fieldsForTrigger(trigger);
  const conditions: DraftAutomation['conditions'] = [];
  for (const c of Array.isArray(r.conditions) ? r.conditions : []) {
    if (!c || typeof c !== 'object') continue;
    const { field, op, value } = c as Record<string, unknown>;
    const f = String(field ?? '');
    const o = String(op ?? '');
    if (!allowedFields.includes(f)) { notes.push(`Ignored a condition on "${f}" — that is not something this trigger can see.`); continue; }
    if (!OPERATOR_VALUES.includes(o)) { notes.push(`Ignored a condition using "${o}" — not a comparison this system does.`); continue; }
    conditions.push({ field: f, op: o, ...(value === undefined || value === null ? {} : { value: String(value) }) });
  }

  const actions: DraftAutomation['actions'] = [];
  for (const a of Array.isArray(r.actions) ? r.actions : []) {
    if (!a || typeof a !== 'object') continue;
    const { type, params } = a as Record<string, unknown>;
    const t = String(type ?? '');
    if (!ACTION_TYPES.includes(t)) { notes.push(`Dropped the action "${t}" — this system cannot do that yet, so it would have looked active and done nothing.`); continue; }
    const spec = AUTOMATION_ACTIONS.find((x) => x.type === t)!;
    const clean: Record<string, unknown> = {};
    const given = (params && typeof params === 'object' ? params : {}) as Record<string, unknown>;
    for (const p of spec.params) {
      if (given[p.key] !== undefined && given[p.key] !== null && given[p.key] !== '') clean[p.key] = given[p.key];
    }
    const missing = spec.params.filter((p) => p.required && clean[p.key] === undefined).map((p) => p.key);
    if (missing.length) notes.push(`"${spec.label}" still needs ${missing.join(' and ')} — choose that before switching it on.`);
    actions.push({ type: t, params: clean });
  }

  if (!actions.length) {
    return { error: 'The AI did not produce anything this system can actually do. Try naming the outcome — "create a task", "tell the managers", "send the reminder email".' };
  }

  return {
    name: String(r.name ?? '').slice(0, 120) || 'New automation',
    description: String(r.description ?? '').slice(0, 400),
    trigger,
    matchAll: r.matchAll !== false,
    conditions,
    actions,
    basedOn: typeof r.basedOn === 'string' ? r.basedOn : undefined,
    notes,
  };
}


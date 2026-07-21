import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { STARTER_AUTOMATIONS } from '@/config/starter-automations';
import {
  TRIGGER_VALUES, ACTION_TYPES, OPERATOR_VALUES, fieldsForTrigger,
} from '@/config/automation-capabilities';

/**
 * The engine falls through to "unknown action" for anything it does not
 * recognise — quietly, with the rule still showing as active. So a template
 * naming an action that does not exist looks perfect and does nothing, which
 * is worse than having no rule at all: you stop watching the thing it was
 * meant to handle.
 */
describe('the capability list matches the engine', () => {
  const engine = readFileSync('src/lib/automation/engine.ts', 'utf8');
  const implemented = [...engine.matchAll(/case '([A-Z_]+)':/g)].map((m) => m[1]!);

  it('every advertised action is implemented', () => {
    const missing = ACTION_TYPES.filter((t) => !implemented.includes(t));
    expect(missing).toEqual([]);
  });

  it('every implemented action is advertised', () => {
    // Comparison operators share the same switch syntax, so only look at the
    // upper-case action names.
    const actionish = implemented.filter((c) => /^[A-Z][A-Z_]+$/.test(c));
    const undocumented = actionish.filter((t) => !ACTION_TYPES.includes(t));
    expect(undocumented).toEqual([]);
  });
});

describe('every starter automation can actually run', () => {
  it.each(STARTER_AUTOMATIONS.map((a) => [a.key, a] as const))('%s', (_key, a) => {
    expect(TRIGGER_VALUES).toContain(a.trigger);

    for (const action of a.actions) {
      expect(ACTION_TYPES, `action ${action.type} in ${a.key}`).toContain(action.type);
    }
    for (const action of a.elseActions ?? []) {
      expect(ACTION_TYPES, `else-action ${action.type} in ${a.key}`).toContain(action.type);
    }
    for (const c of a.conditions ?? []) {
      expect(OPERATOR_VALUES, `operator ${c.op} in ${a.key}`).toContain(c.op);
      const allowed = fieldsForTrigger(a.trigger);
      expect(allowed, `field ${c.field} in ${a.key}`).toContain(c.field);
    }
  });

  it('has no duplicate keys', () => {
    const keys = STARTER_AUTOMATIONS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('offers a decent library', () => {
    expect(STARTER_AUTOMATIONS.length).toBeGreaterThanOrEqual(60);
  });
});

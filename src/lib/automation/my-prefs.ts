// Client-safe per-user automation preferences (no server-only imports).

export const AUTOMATION_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type AutomationPriority = (typeof AUTOMATION_PRIORITIES)[number];

export interface MyAutomationPref { on: boolean; dueInDays?: number; priority?: string }
export type MyAutomationPrefs = Record<string, MyAutomationPref>;

export function readMyAutomationPrefs(raw: unknown): MyAutomationPrefs {
  if (!raw || typeof raw !== 'object') return {};
  const out: MyAutomationPrefs = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== 'object') continue;
    const v = val as Record<string, unknown>;
    const pref: MyAutomationPref = { on: v.on === true };
    if (typeof v.dueInDays === 'number' && v.dueInDays >= 0 && v.dueInDays <= 365) pref.dueInDays = Math.round(v.dueInDays);
    if (typeof v.priority === 'string' && (AUTOMATION_PRIORITIES as readonly string[]).includes(v.priority)) pref.priority = v.priority;
    out[key] = pref;
  }
  return out;
}

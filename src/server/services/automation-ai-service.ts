import 'server-only';
import { aiChat } from '@/lib/ai/provider';
import { AUTOMATION_TRIGGERS, AUTOMATION_ACTIONS, AUTOMATION_OPERATORS } from '@/config/automation-capabilities';
import { sanitise, type DraftAutomation } from '@/lib/automation/sanitise';

export { sanitise };
export type { DraftAutomation };
import { STARTER_AUTOMATIONS } from '@/config/starter-automations';

function capabilityBrief(): string {
  const triggers = AUTOMATION_TRIGGERS
    .map((t) => `- ${t.value}: ${t.fires} Fields you may test: ${t.fields.length ? t.fields.join(', ') : '(none)'}`)
    .join('\n');
  const actions = AUTOMATION_ACTIONS
    .map((a) => `- ${a.type}: ${a.describe} Parameters: ${a.params.map((p) => `${p.key}${p.required ? ' (required)' : ''}`).join(', ')}`)
    .join('\n');
  const ops = AUTOMATION_OPERATORS.map((o) => `${o.op} (${o.label})`).join(', ');
  return `TRIGGERS\n${triggers}\n\nACTIONS\n${actions}\n\nOPERATORS\n${ops}`;
}

/** A few close templates, to steer wording and structure. */
function nearestTemplates(request: string, n = 6): typeof STARTER_AUTOMATIONS {
  const words = request.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
  const scored = STARTER_AUTOMATIONS.map((a) => {
    const hay = `${a.name} ${a.what} ${a.why} ${a.department}`.toLowerCase();
    return { a, score: words.filter((w) => hay.includes(w)).length };
  });
  return scored.sort((x, y) => y.score - x.score).slice(0, n).map((s) => s.a);
}


export async function draftAutomationFromWords(request: string): Promise<DraftAutomation | { error: string }> {
  const examples = nearestTemplates(request)
    .map((t) => JSON.stringify({ name: t.name, trigger: t.trigger, conditions: t.conditions ?? [], actions: t.actions }))
    .join('\n');

  const system = [
    'You turn a plain-English request into one automation rule for a property developer\'s CRM.',
    'You may ONLY use the triggers, fields, operators and actions listed. Never invent any.',
    'If the request needs something not listed, get as close as you can with what exists and say so in "description".',
    'Prefer NOTIFY_ROLE over NOTIFY_USER, because rules aimed at a named person break when that person leaves.',
    'Leave a parameter out entirely rather than inventing an id for it. Never invent user ids.',
    'Reply with JSON only: {"name","description","trigger","matchAll","conditions":[{"field","op","value"}],"actions":[{"type","params"}],"basedOn"}',
    '',
    capabilityBrief(),
    '',
    'EXAMPLES OF GOOD RULES',
    examples,
  ].join('\n');

  const res = await aiChat({
    system,
    prompt: `Build one automation for this request:\n\n"${request}"`,
    json: true,
    temperature: 0.2,
    maxTokens: 900,
  });
  if (!res.ok) return { error: res.error };

  let parsed: unknown;
  try {
    // Models sometimes wrap JSON in prose or a code fence despite being asked not to.
    const text = res.text.trim();
    const body = text.startsWith('{') ? text : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    parsed = JSON.parse(body);
  } catch {
    return { error: 'The AI replied with something that was not an automation. Try again, or describe it more simply.' };
  }
  return sanitise(parsed);
}

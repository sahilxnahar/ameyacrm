/**
 * The daily-briefing content layer (intra-system intelligence).
 *
 * The briefing dashboard already gathers company-wide signals and rule-based
 * risk alerts (see `briefing-service`). Turning those into a short executive
 * summary used to be hard-wired to Google Gemini — a dead account on this
 * deployment — so the AI summary silently never appeared. This module makes the
 * summary provider-agnostic:
 *
 *   - `buildBriefingSignalsPrompt` frames the numbers for any OpenAI-compatible
 *     model (OpenRouter today) and asks for strict JSON.
 *   - `parseBriefingJson` reads that JSON back safely.
 *   - `fallbackBriefing` builds a genuinely useful summary with NO model at all,
 *     from the same rule-based alerts, so the feature never breaks.
 *
 * This file is PURE and client-safe: no database, no env, no `server-only`, so
 * it is unit-tested and can be shared by server and client.
 */

export interface BriefingContent {
  headline: string;
  bullets: string[];
  actions: string[];
}

export type AlertSeverity = 'high' | 'medium' | 'low';
export interface BriefAlert {
  severity: AlertSeverity;
  title: string;
  detail: string;
}

/** The instruction sent to an OpenAI-compatible model. Asks for strict JSON. */
export function buildBriefingSignalsPrompt(signalsText: string): string {
  return [
    'You are the sales director of a Bengaluru real-estate developer reading the CRM first thing in the morning.',
    'From the numbers below, respond with ONLY a JSON object (no markdown, no prose around it) of this exact shape:',
    '{"headline": string, "bullets": string[], "actions": string[]}',
    '- headline: one line on where the business stands today.',
    '- bullets: 3 to 5 short points on what changed and what is at risk. Quote the numbers. Be specific.',
    '- actions: exactly 3 concrete things to do today, each starting with a verb.',
    'Use only the figures given. Do not invent any numbers. Be direct and brief.',
    '',
    'SIGNALS:',
    signalsText,
  ].join('\n');
}

function coerceStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => String(x).trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Parse a model's reply into briefing content. Tolerant of code fences and of
 * stray text around the JSON. Returns null when there is no usable headline.
 */
export function parseBriefingJson(raw: string): BriefingContent | null {
  if (!raw) return null;
  let text = raw.trim();
  // Strip a ```json ... ``` fence if the model added one.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) text = fence[1].trim();
  // If there is prose around the object, keep the outermost {...}.
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) text = text.slice(first, last + 1);
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    const headline = String(j.headline ?? '').trim().slice(0, 240);
    if (!headline) return null;
    return {
      headline,
      bullets: coerceStringArray(j.bullets, 6),
      actions: coerceStringArray(j.actions, 6),
    };
  } catch {
    return null;
  }
}

/**
 * A deterministic briefing built from the rule-based alerts alone — the summary
 * shown when no AI provider is configured, or when a model call fails. Honest
 * and useful on its own, never empty.
 */
export function fallbackBriefing(alerts: BriefAlert[]): BriefingContent {
  const high = alerts.filter((a) => a.severity === 'high');
  const medium = alerts.filter((a) => a.severity === 'medium');

  let headline: string;
  if (high.length > 0) {
    headline = `${high.length} high-priority issue${high.length === 1 ? '' : 's'} need attention today.`;
  } else if (medium.length > 0) {
    headline = `${medium.length} item${medium.length === 1 ? '' : 's'} need attention — nothing critical.`;
  } else if (alerts.length > 0) {
    headline = `A few low-priority items to tidy up (${alerts.length}).`;
  } else {
    headline = 'Clean board — nothing needs attention right now.';
  }

  const bullets = alerts.slice(0, 5).map((a) => `${a.title} — ${a.detail}`);

  // Verb-first actions from the most severe alerts first.
  const rank: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 };
  const actions = [...alerts]
    .sort((a, b) => rank[a.severity] - rank[b.severity])
    .slice(0, 3)
    .map((a) => `Handle: ${a.title}`);

  return { headline, bullets, actions };
}

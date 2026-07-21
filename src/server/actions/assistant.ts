'use server';
import { getActionContext, toActionError } from './_helpers';
import { aiChat, activeProvider } from '@/lib/ai/provider';

export type AssistantTurn = { role: 'user' | 'assistant'; content: string };
export type AssistantResult = { ok: true; text: string } | { ok: false; error: string; needsKey?: boolean };

const SYSTEM = [
  'You are the built-in assistant inside the Ameya Heights CRM — an Indian real-estate developer\'s CRM & ERP.',
  'Help the user get things done: draft follow-up messages and emails to buyers or brokers, summarise text they paste,',
  'explain what a screen or a term means in plain English, and suggest sensible next steps.',
  'Be concise and practical. Use Indian context (₹, lakhs/crores, RERA, GST) where relevant.',
  'You do NOT have live access to the database, so for a specific lead, booking or payment, ask the user to paste the details.',
  'Never invent figures or facts. If you are unsure, say so.',
].join(' ');

/**
 * Ask the assistant. Rides the SAME provider + key-rotation as the rest of the
 * AI features (primary AI_API_KEY, spares in AI_API_KEYS, then the fallback
 * provider), so backup keys added in Vercel apply here too. If no AI key is set,
 * it says so plainly rather than erroring — the "help, don't break" rule.
 */
export async function askAssistant(history: AssistantTurn[]): Promise<AssistantResult> {
  try {
    await getActionContext();
    if (activeProvider().kind === 'none') {
      return {
        ok: false,
        needsKey: true,
        error: 'The assistant isn’t switched on yet. Add an AI key in Vercel (AI_API_KEY for OpenRouter, or GEMINI_API_KEY) and redeploy — then it works here automatically.',
      };
    }
    const turns = (history ?? []).filter((t) => t && typeof t.content === 'string' && t.content.trim()).slice(-12);
    if (turns.length === 0) return { ok: false, error: 'Type a question first.' };

    const convo = turns.map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content.trim()}`).join('\n\n');
    const prompt = `${convo}\n\nAssistant:`;

    const r = await aiChat({ prompt, system: SYSTEM, temperature: 0.4 });
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, text: r.text.trim() };
  } catch (e) {
    return { ok: false, error: toActionError(e).error };
  }
}

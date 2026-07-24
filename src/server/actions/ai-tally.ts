'use server';
import { prisma } from '@/lib/db/prisma';
import { ensure, toActionError } from './_helpers';
import { aiChat } from '@/lib/ai/provider';
import { VOUCHER_TYPES } from '@/config/tally-groups';

/**
 * The agentic Tally assistant.
 *
 * You type an instruction in plain words — "pay ₹50,000 to ABC Cement by bank
 * for cement" — and this drafts the balanced double-entry voucher for you to
 * review. It NEVER posts on its own: the draft comes back, you confirm, and only
 * then is it written (through the same createTallyVoucher path a manual entry
 * uses, with the same validation and audit trail). That confirm step is
 * deliberate — money entries should never be created behind your back.
 */

export interface DraftLine {
  ledgerId: string | null;   // resolved to an existing ledger, or null if it must be created
  ledgerName: string;
  debit: number;
  credit: number;
}
export interface VoucherDraft {
  type: string;
  date: string;              // YYYY-MM-DD
  narration: string;
  reference?: string;
  lines: DraftLine[];
  totalDr: number;
  totalCr: number;
  balanced: boolean;
  needLedgers: string[];     // ledger names the entry needs that don't exist yet
  clarification?: string;    // set when the instruction was too vague to draft
}
export type TallyAiResult = { ok: true; draft: VoucherDraft } | { error: string };

export async function aiTallyCommand(prompt: string): Promise<TallyAiResult> {
  try {
    await ensure('finance.ledger.view');
    const text = (prompt || '').trim();
    if (!text) return { error: 'Type what you want to record.' };
    if (text.length > 1000) return { error: 'That is very long — keep the instruction to a sentence or two.' };

    const ledgers = await prisma.tallyLedger.findMany({ select: { id: true, name: true, group: true }, orderBy: { name: 'asc' }, take: 500 });
    const ledgerList = ledgers.map((l) => `- ${l.name} (${l.group})`).join('\n');
    const today = new Date().toISOString().slice(0, 10);

    const system = [
      "You are an accounting assistant for an Indian real-estate company's Tally-style books.",
      'Convert the user instruction into ONE balanced double-entry voucher.',
      `- "type" must be exactly one of: ${VOUCHER_TYPES.join(', ')}. Money paid out = "Payment"; money received = "Receipt"; moving between cash and bank = "Contra"; anything else / adjustments = "Journal".`,
      '- Use ONLY the existing ledgers below, by their EXACT name. If the entry needs a ledger that is not listed, still write the line using a sensible name and add that name to "needLedgers".',
      ledgerList ? `Existing ledgers:\n${ledgerList}` : 'There are no ledgers yet.',
      '- A voucher needs at least 2 lines and total debit MUST equal total credit.',
      '- For a Payment: debit the expense or party ledger, credit Cash or Bank. For a Receipt: debit Cash/Bank, credit the income or party ledger.',
      '- Each line has EITHER a debit OR a credit (the other is 0). Amounts are plain numbers in rupees, no symbols or commas.',
      `- "date" is YYYY-MM-DD; default to ${today} if not stated.`,
      '- If the instruction is too vague to build a balanced entry, set "clarification" to a short question and return empty "lines".',
      'Return STRICT JSON only: {"type":"","date":"","narration":"","reference":"","lines":[{"ledgerName":"","debit":0,"credit":0}],"needLedgers":[],"clarification":""}',
    ].join('\n');

    const r = await aiChat({ system, prompt: text, json: true, temperature: 0.1, maxTokens: 800 });
    if (!r.ok) return { error: r.error };

    let parsed: {
      type?: string; date?: string; narration?: string; reference?: string;
      lines?: Array<{ ledgerName?: string; debit?: unknown; credit?: unknown }>;
      needLedgers?: unknown[]; clarification?: string;
    };
    try { parsed = JSON.parse(r.text); } catch { return { error: 'The assistant did not return a usable entry. Try rephrasing it more plainly.' }; }

    const byName = new Map(ledgers.map((l) => [l.name.toLowerCase(), l.id]));
    const rawLines = Array.isArray(parsed.lines) ? parsed.lines : [];
    const lines: DraftLine[] = rawLines
      .map((l) => {
        const name = String(l.ledgerName ?? '').trim();
        if (!name) return null;
        const key = name.toLowerCase();
        const exact = byName.get(key) ?? null;
        const fuzzy = exact ?? ledgers.find((g) => g.name.toLowerCase().includes(key) || key.includes(g.name.toLowerCase()))?.id ?? null;
        return { ledgerId: fuzzy, ledgerName: name, debit: Math.max(0, Number(l.debit) || 0), credit: Math.max(0, Number(l.credit) || 0) };
      })
      .filter((l): l is DraftLine => l !== null && (l.debit > 0 || l.credit > 0));

    const need = new Set<string>((Array.isArray(parsed.needLedgers) ? parsed.needLedgers : []).map((n) => String(n)).filter(Boolean));
    for (const l of lines) if (!l.ledgerId) need.add(l.ledgerName);

    const totalDr = Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100;
    const totalCr = Math.round(lines.reduce((s, l) => s + l.credit, 0) * 100) / 100;
    const type = (VOUCHER_TYPES as readonly string[]).includes(String(parsed.type)) ? String(parsed.type) : 'Journal';

    return {
      ok: true,
      draft: {
        type,
        date: String(parsed.date || today).slice(0, 10),
        narration: String(parsed.narration || text).slice(0, 500),
        reference: parsed.reference ? String(parsed.reference).slice(0, 80) : undefined,
        lines,
        totalDr,
        totalCr,
        balanced: totalDr > 0 && totalDr === totalCr,
        needLedgers: [...need],
        clarification: parsed.clarification ? String(parsed.clarification).slice(0, 300) : undefined,
      },
    };
  } catch (e) { return toActionError(e); }
}

import 'server-only';
import { env } from '@/config/env';
import { aiChat, activeProvider } from '@/lib/ai/provider';
import { inferMimeType, fileKindLabel } from '@/lib/files/mime';
// Re-exported so existing callers importing these from here keep working.
export { inferMimeType, fileKindLabel };


/**
 * Turn Google's error body into something a person can act on.
 *
 * A 403 PERMISSION_DENIED is not a bad upload and not a bug in the CRM — the
 * key's project has been blocked — so saying "the AI service refused the file"
 * sends people hunting in the wrong place.
 */
export function explainAiFailure(status: number, body: string): string {
  if (status === 403 && /PERMISSION_DENIED|denied access/i.test(body)) {
    return 'Google has blocked the project behind your AI key, so nothing AI-powered will work until it is replaced. ' +
      'Go to aistudio.google.com/apikey, create a new key in a NEW project, update GEMINI_API_KEY in Vercel and redeploy. ' +
      'Admin > AI Health will confirm once it is fixed.';
  }
  if (status === 429) return 'The AI is rate limited or out of free quota for now. Try again in a few minutes.';
  if (status === 400) return 'The AI could not read that file. If it is a scan, try a clearer copy or a PDF.';
  if (status === 401) return 'The AI key was not accepted. Check GEMINI_API_KEY in Vercel.';
  return `The AI service returned an error (${status}). ${body.slice(0, 160)}`.trim();
}

/** True when ANY provider is configured — Google, or the fallback. */
export function isGeminiEnabled(): boolean {
  return Boolean(env.GEMINI_API_KEY) || Boolean(env.AI_BASE_URL && env.AI_API_KEY);
}
export function geminiSupports(mimeType: string): boolean {
  return mimeType === 'application/pdf' || mimeType.startsWith('image/') || mimeType.startsWith('text/');
}



/** Summarize a file with Gemini (multimodal). Returns null (never throws) on any problem. */
export async function summarizeFile(buffer: Buffer, mimeType: string, filename: string): Promise<string | null> {
  if (!env.GEMINI_API_KEY || !geminiSupports(mimeType)) return null;
  if (buffer.length > 15 * 1024 * 1024) return null;
  const prompt =
    `You are a document assistant for a real-estate CRM (Ameya Heights). Analyse the attached file "${filename}" and reply with:\n` +
    `1) A 2-4 sentence summary — what it is, key parties / amounts / dates, and why it matters.\n` +
    `2) A line "Key details:" then 3-6 short bullet points of the most important data.\n` +
    `Be concise and factual. If it's an image, describe what it shows.`;
  const body = {
    contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: buffer.toString('base64') } }, { text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 600 },
  };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n');
    return text?.trim() || null;
  } catch {
    return null;
  }
}

export interface ExtractedBillItem { description: string; quantity: number; rate: number; gstRate: number; amount: number }
export interface ExtractedBill {
  clientName: string; clientGstin: string | null; invoiceNumber: string | null; invoiceDate: string | null;
  items: ExtractedBillItem[]; subTotal: number | null; totalGst: number | null; total: number | null;
}

const BILL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    clientName: { type: 'STRING' },
    clientGstin: { type: 'STRING', nullable: true },
    invoiceNumber: { type: 'STRING', nullable: true },
    invoiceDate: { type: 'STRING', nullable: true },
    items: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      description: { type: 'STRING' }, quantity: { type: 'NUMBER' }, rate: { type: 'NUMBER' }, gstRate: { type: 'NUMBER' }, amount: { type: 'NUMBER' },
    } } },
    subTotal: { type: 'NUMBER', nullable: true },
    totalGst: { type: 'NUMBER', nullable: true },
    total: { type: 'NUMBER', nullable: true },
  },
} as const;

const numOr = (v: unknown, d = 0) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : d; };

/** Extract structured billing data (vendor, GSTIN, date, line items, totals) from a bill/invoice file. Never throws — null on any problem. */
export async function extractInvoiceData(
  buffer: Buffer, mimeType: string, filename: string,
): Promise<ExtractedBill | { error: string } | null> {
  if (!env.GEMINI_API_KEY) return { error: 'No Gemini key is configured, so files cannot be read.' };
  const type = inferMimeType(mimeType, filename);
  if (!geminiSupports(type)) {
    return { error: `"${filename}" is a ${type || 'file type we could not identify'}. Only PDFs, images and text files can be read.` };
  }
  if (buffer.length > 15 * 1024 * 1024) return { error: 'That file is over 15MB, which is more than the reader accepts.' };
  const prompt =
    `Extract the billing / invoice data from the attached file "${filename}". Return the vendor or company name (clientName), ` +
    `their GST number (clientGstin), the invoice number, the invoice/purchase date as YYYY-MM-DD, and every line item ` +
    `(description, quantity, unit price as "rate", GST rate percent as "gstRate", and line total as "amount"). ` +
    `Also return subTotal (before GST), totalGst, and total (grand total including GST). Use null for anything not present. ` +
    `All monetary/numeric values must be plain numbers with no currency symbols or commas.`;
  const body = {
    contents: [{ parts: [{ inline_data: { mime_type: type, data: buffer.toString('base64') } }, { text: prompt }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: BILL_SCHEMA },
  };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { error: explainAiFailure(res.status, detail) };
    }
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') ?? '';
    if (!raw) return { error: 'The AI read the file but found no billing data in it. Is this actually an invoice?' };
    const j = JSON.parse(raw) as Record<string, unknown>;
    const items = Array.isArray(j.items) ? (j.items as Record<string, unknown>[]).map((it) => ({
      description: String(it.description ?? '').slice(0, 200) || 'Item',
      quantity: numOr(it.quantity, 1), rate: numOr(it.rate), gstRate: numOr(it.gstRate, 18), amount: numOr(it.amount),
    })) : [];
    return {
      clientName: String(j.clientName ?? '').slice(0, 160) || 'Unknown vendor',
      clientGstin: j.clientGstin ? String(j.clientGstin).slice(0, 30) : null,
      invoiceNumber: j.invoiceNumber ? String(j.invoiceNumber).slice(0, 60) : null,
      invoiceDate: j.invoiceDate ? String(j.invoiceDate).slice(0, 10) : null,
      items, subTotal: j.subTotal == null ? null : numOr(j.subTotal), totalGst: j.totalGst == null ? null : numOr(j.totalGst), total: j.total == null ? null : numOr(j.total),
    };
  } catch {
    return null;
  }
}

export interface LeadScore { score: number; reason: string; nextAction: string }
const LEAD_SCORE_SCHEMA = { type: 'OBJECT', properties: { score: { type: 'INTEGER' }, reason: { type: 'STRING' }, nextAction: { type: 'STRING' } } } as const;

/** Score a lead 0-100 with a reason + next-best-action. Never throws — null on any problem. */
export async function scoreLeadWithGemini(leadSummary: string): Promise<LeadScore | { error: string } | null> {
  if (!env.GEMINI_API_KEY) return null;
  const prompt =
    `You are a senior real-estate sales manager at a premium Bengaluru developer. Read the lead below and return: ` +
    `an integer "score" 0-100 for likelihood to book, a one-sentence "reason", and the single best "nextAction" for the rep. Be decisive.\n\nLEAD:\n` + leadSummary;
  const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, responseMimeType: 'application/json', responseSchema: LEAD_SCORE_SCHEMA } };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { error: `The AI service refused the request (${res.status}). ${detail.slice(0, 160)}`.trim() };
    }
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') ?? '';
    if (!raw) return { error: 'The AI did not return a score for this lead. Try again in a moment.' };
    const j = JSON.parse(raw) as { score?: unknown; reason?: unknown; nextAction?: unknown };
    const score = Math.max(0, Math.min(100, Math.round(Number(j.score) || 0)));
    return { score, reason: String(j.reason ?? '').slice(0, 300), nextAction: String(j.nextAction ?? '').slice(0, 300) };
  } catch { return null; }
}

export interface CallAnalysis { transcript: string; summary: string; budget: string | null; typology: string | null; timeline: string | null; sentiment: string; nextAction: string }
const CALL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING' }, summary: { type: 'STRING' },
    budget: { type: 'STRING', nullable: true }, typology: { type: 'STRING', nullable: true },
    timeline: { type: 'STRING', nullable: true }, sentiment: { type: 'STRING' }, nextAction: { type: 'STRING' },
  },
} as const;

/** Transcribe + analyse a sales call recording (English/Hindi/Kannada mix). Never throws — null on any problem. */
export async function analyzeCallRecording(audio: Buffer, mimeType: string): Promise<CallAnalysis | { error: string } | null> {
  if (!env.GEMINI_API_KEY) return null;
  if (audio.length > 18 * 1024 * 1024) return null;
  const prompt =
    'You are a senior real-estate sales manager in Bengaluru. The attached audio is a sales call that may mix English, Hindi and Kannada. ' +
    'Return: a concise "transcript" (speaker-labelled where possible), a 2-3 sentence "summary", the buyer "budget" if mentioned, ' +
    'the "typology" (e.g. 2BHK/3BHK) if mentioned, the possession "timeline" if mentioned, the caller "sentiment" ' +
    '(positive / neutral / negative), and the single best "nextAction" for the rep. Use null where not mentioned.';
  const body = {
    contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: audio.toString('base64') } }, { text: prompt }] }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: CALL_SCHEMA },
  };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { error: explainAiFailure(res.status, detail) };
    }
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') ?? '';
    if (!raw) return { error: 'The AI read the file but found no billing data in it. Is this actually an invoice?' };
    const j = JSON.parse(raw) as Record<string, unknown>;
    const str = (v: unknown, max = 400) => (v == null ? null : String(v).slice(0, max));
    return {
      transcript: String(j.transcript ?? '').slice(0, 6000), summary: String(j.summary ?? '').slice(0, 800),
      budget: str(j.budget, 80), typology: str(j.typology, 40), timeline: str(j.timeline, 80),
      sentiment: String(j.sentiment ?? 'neutral').slice(0, 20), nextAction: String(j.nextAction ?? '').slice(0, 300),
    };
  } catch { return null; }
}

export interface Briefing { headline: string; bullets: string[]; actions: string[] }
const BRIEF_SCHEMA = { type: 'OBJECT', properties: {
  headline: { type: 'STRING' },
  bullets: { type: 'ARRAY', items: { type: 'STRING' } },
  actions: { type: 'ARRAY', items: { type: 'STRING' } },
} } as const;

/** Turn today's CRM signals into a short executive briefing. Never throws — null on failure. */
export async function generateBriefing(signals: string): Promise<Briefing | null> {
  if (!env.GEMINI_API_KEY) return null;
  const prompt =
    'You are the sales director of a Bengaluru real-estate developer reading the CRM first thing in the morning. ' +
    'From the numbers below write: a one-line "headline" on where the business stands today; 3-5 short "bullets" ' +
    'on what changed and what is at risk (be specific, quote the numbers); and 3 concrete "actions" for today, ' +
    'each starting with a verb. Be direct and brief. No preamble.\n\nSIGNALS:\n' + signals;
  const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.35, responseMimeType: 'application/json', responseSchema: BRIEF_SCHEMA } };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) return null;
    const d = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = d.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') ?? '';
    if (!raw) return null;
    const j = JSON.parse(raw) as Record<string, unknown>;
    const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).slice(0, 300)).slice(0, 6) : []);
    return { headline: String(j.headline ?? '').slice(0, 240), bullets: arr(j.bullets), actions: arr(j.actions) };
  } catch { return null; }
}

export interface VoiceNote { transcript: string; kind: 'update' | 'task'; title: string; description: string; priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' }
const VOICE_SCHEMA = { type: 'OBJECT', properties: {
  transcript: { type: 'STRING' }, kind: { type: 'STRING' }, title: { type: 'STRING' },
  description: { type: 'STRING' }, priority: { type: 'STRING' },
} } as const;

/** Transcribe a site voice note and structure it into an update or a task. */
export async function transcribeSiteNote(audio: Buffer, mimeType: string): Promise<VoiceNote | null> {
  if (!env.GEMINI_API_KEY) return null;
  if (audio.length > 18 * 1024 * 1024) return null;
  const prompt =
    'This is a voice note from a site engineer at a Bengaluru construction site. It may mix English, Hindi and Kannada. ' +
    'Return: the full "transcript"; "kind" = "update" if it reports site progress, or "task" if it asks for something to be done/fixed; ' +
    'a short "title" (max 10 words); a clear "description" in professional English; and "priority" ' +
    '(LOW, MEDIUM, HIGH or URGENT) based on urgency expressed.';
  const body = { contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: audio.toString('base64') } }, { text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: VOICE_SCHEMA } };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) return null;
    const d = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = d.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') ?? '';
    if (!raw) return null;
    const j = JSON.parse(raw) as Record<string, unknown>;
    const pr = String(j.priority ?? 'MEDIUM').toUpperCase();
    return {
      transcript: String(j.transcript ?? '').slice(0, 5000),
      kind: String(j.kind ?? 'update').toLowerCase() === 'task' ? 'task' : 'update',
      title: String(j.title ?? 'Site note').slice(0, 160),
      description: String(j.description ?? '').slice(0, 2000),
      priority: (['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(pr) ? pr : 'MEDIUM') as VoiceNote['priority'],
    };
  } catch { return null; }
}

export interface SocialBrief { summary: string; importance: 'high' | 'normal' | 'low'; isLead: boolean }
const SOCIAL_SCHEMA = { type: 'OBJECT', properties: {
  summary: { type: 'STRING' }, importance: { type: 'STRING' }, isLead: { type: 'BOOLEAN' },
} } as const;

/**
 * Turn a raw social notification into one plain sentence a busy person can read
 * at a glance, and say whether it looks like a genuine buyer enquiry.
 */
export async function summarizeSocialActivity(input: {
  channel: string; kind: string; name?: string | null; handle?: string | null; message?: string | null;
}): Promise<SocialBrief | null> {
  if (!env.GEMINI_API_KEY) return null;
  const prompt =
    'You work for a Bengaluru real-estate developer. Below is a raw notification from a social platform. ' +
    'Write "summary": ONE short sentence (max 22 words) saying what happened and what it means commercially, ' +
    'in plain English, no jargon, no preamble. Set "importance" to "high" if someone is asking about price, ' +
    'availability, a site visit or possession; "normal" for ordinary engagement; "low" for follows and likes. ' +
    'Set "isLead" true only if a real person is enquiring about buying or renting.\n\nNOTIFICATION:\n' +
    JSON.stringify(input).slice(0, 4000);
  const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: SOCIAL_SCHEMA } };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) return null;
    const d = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = d.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') ?? '';
    if (!raw) return null;
    const j = JSON.parse(raw) as Record<string, unknown>;
    const imp = String(j.importance ?? 'normal').toLowerCase();
    return {
      summary: String(j.summary ?? '').slice(0, 240),
      importance: imp === 'high' || imp === 'low' ? imp : 'normal',
      isLead: Boolean(j.isLead),
    };
  } catch { return null; }
}


export interface ExtractedPayment {
  partyName: string | null;
  amount: number | null;
  paidOn: string | null; // ISO date
  utr: string | null;
  mode: 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'CARD' | null;
  bankName: string | null;
  narration: string | null;
  confidence: 'high' | 'medium' | 'low';
}

const PAYMENT_PROMPT =
  'You are reading proof of an Indian bank payment: a bank SMS, a UPI app screenshot, a NEFT/RTGS advice, ' +
  'a payment confirmation email or a statement line. Extract the transfer.\n' +
  'Rules:\n' +
  '- amount: a plain number in rupees, no commas or symbols. Ignore any available-balance figure.\n' +
  '- utr: the UTR / RRN / transaction reference / bank reference number. Digits and capitals only, no spaces. null if absent.\n' +
  '- paidOn: the transaction date as YYYY-MM-DD. Assume Indian day-first order for ambiguous dates.\n' +
  '- partyName: who the money went TO (the beneficiary/payee). Not the sender, not the bank.\n' +
  '- mode: one of CASH, BANK_TRANSFER, UPI, CHEQUE, CARD.\n' +
  '- bankName: the bank that sent the money.\n' +
  '- narration: a short description of what the payment was for, if stated.\n' +
  '- confidence: high only if you can read an amount AND a reference number clearly.\n' +
  'Use null for anything not clearly present. Never invent a UTR.';

const PAYMENT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    partyName: { type: 'STRING', nullable: true },
    amount: { type: 'NUMBER', nullable: true },
    paidOn: { type: 'STRING', nullable: true },
    utr: { type: 'STRING', nullable: true },
    mode: { type: 'STRING', nullable: true },
    bankName: { type: 'STRING', nullable: true },
    narration: { type: 'STRING', nullable: true },
    confidence: { type: 'STRING' },
  },
  required: ['confidence'],
} as const;

/**
 * Read a payment confirmation and pull out the UTR, amount, date and payee.
 * Accepts pasted text or a screenshot/PDF. Returns null (never throws) on any
 * problem so the form always stays usable by hand.
 */
export async function extractPaymentAdvice(
  input: { text: string } | { buffer: Buffer; mimeType: string },
): Promise<ExtractedPayment | null> {
  if (!isGeminiEnabled()) return null;

  // Pasted text works on any provider. Screenshots need one that reads images,
  // which today means Google.
  if ('text' in input && activeProvider().kind === 'openai-compatible') {
    const r = await aiChat({
      system: PAYMENT_PROMPT + '\nReply with JSON only, no commentary.',
      prompt: `Payment confirmation:\n\n${input.text.trim().slice(0, 6000)}`,
      json: true, temperature: 0,
    });
    if (!r.ok) return null;
    try {
      return normalisePayment(JSON.parse(r.text.replace(/^```(?:json)?|```$/g, '').trim()) as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  if (!env.GEMINI_API_KEY) return null;

  const parts: Array<Record<string, unknown>> = [];
  if ('buffer' in input) {
    if (!geminiSupports(input.mimeType) || input.buffer.length > 15 * 1024 * 1024) return null;
    parts.push({ inline_data: { mime_type: input.mimeType, data: input.buffer.toString('base64') } });
  } else {
    const t = input.text.trim();
    if (!t) return null;
    parts.push({ text: `Payment confirmation:\n\n${t.slice(0, 6000)}` });
  }
  parts.push({ text: PAYMENT_PROMPT });

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: PAYMENT_SCHEMA },
        }),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;
    return normalisePayment(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** Tidy whatever the model returned into the shape the CRM expects. */
function normalisePayment(p: Record<string, unknown>): ExtractedPayment {
  {
    const amount = typeof p.amount === 'number' && Number.isFinite(p.amount) && p.amount > 0 ? p.amount : null;
    const utr = typeof p.utr === 'string' ? p.utr.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || null : null;
    const modes = ['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD'];
    const mode = typeof p.mode === 'string' && modes.includes(p.mode.toUpperCase()) ? (p.mode.toUpperCase() as ExtractedPayment['mode']) : null;
    const paidOn = typeof p.paidOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.paidOn) ? p.paidOn : null;
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null);

    return {
      partyName: str(p.partyName), amount, paidOn, utr, mode,
      bankName: str(p.bankName), narration: str(p.narration),
      confidence: p.confidence === 'high' || p.confidence === 'medium' ? p.confidence : 'low',
    };
  }
}

/**
 * Embedding models, newest first. Google retires these periodically —
 * text-embedding-004 started returning 404 on keys created in newer projects —
 * so the code tries each in turn rather than trusting one name.
 */
export const EMBEDDING_MODELS = ['gemini-embedding-001', 'text-embedding-004', 'embedding-001'] as const;

export interface AiProbe { name: string; what: string; ok: boolean; ms: number; detail: string }

/**
 * Actually call Gemini and report what came back, rather than reporting that a
 * key exists. A configured key that is expired, out of quota or region-blocked
 * looks identical to a working one until something is sent through it.
 */
export async function runAiSelfTest(): Promise<{ enabled: boolean; model: string; provider: string; probes: AiProbe[] }> {
  const p = activeProvider();

  if (p.kind === 'none') {
    return {
      enabled: false, model: '—', provider: 'not configured',
      probes: [{
        name: 'No provider', what: 'Somewhere for the AI to run', ok: false, ms: 0,
        detail: 'Set either GEMINI_API_KEY, or AI_BASE_URL + AI_API_KEY + AI_MODEL for a non-Google provider. Then redeploy.',
      }],
    };
  }

  // The fallback provider has its own, much shorter, set of checks.
  if (p.kind === 'openai-compatible') {
    const probes: AiProbe[] = [];
    const t0 = Date.now();
    const chat = await aiChat({ prompt: 'Reply with exactly: ALIVE', temperature: 0, maxTokens: 10 });
    probes.push({
      name: 'Writing', what: `${p.label} · ${p.model}`, ms: Date.now() - t0,
      ok: chat.ok && /ALIVE/i.test(chat.text),
      detail: chat.ok ? `Replied "${chat.text.slice(0, 40)}"` : chat.error,
    });

    const t1 = Date.now();
    const sample = 'Dear Customer, Rs.3,50,000.00 has been debited from your Kotak A/c XX8556 on 05-01-2026 to SV ENTERPRISES via NEFT. UTR: KKBKN52026010500123456.';
    const read = await extractPaymentAdvice({ text: sample });
    probes.push({
      name: 'Reading payments', what: 'Pulls a UTR and amount out of a bank message', ms: Date.now() - t1,
      ok: read?.amount === 350000 && read?.utr === 'KKBKN52026010500123456',
      detail: read ? `Read ${read.amount ?? 'nothing'} and UTR ${read.utr ?? 'nothing'}` : 'No usable reply came back.',
    });

    const t2 = Date.now();
    if (env.AI_EMBED_MODEL) {
      const { aiEmbed } = await import('@/lib/ai/provider');
      const v = await aiEmbed('payment voucher');
      probes.push({
        name: 'Search index', what: `Embeddings via ${env.AI_EMBED_MODEL}`, ms: Date.now() - t2,
        ok: Boolean(v?.length), detail: v?.length ? `${v.length}-dimension vector returned` : 'No vector came back.',
      });
    } else {
      probes.push({
        name: 'Search index', what: 'Embeddings for document search', ms: 0, ok: false,
        detail: 'AI_EMBED_MODEL is not set, so Ask Documents falls back to plain keyword matching. That still works — it is just less clever.',
      });
    }

    probes.push({
      name: 'Reading files', what: 'Bills, scans and photos', ms: 0, ok: false,
      detail: 'This provider reads text, not PDFs or images. Bill import and document summaries need Google, and stay off until that account is unblocked.',
    });

    return { enabled: true, model: p.model, provider: p.label, probes };
  }

  const model = env.GEMINI_MODEL;
  const probes: AiProbe[] = [];
  const timed = async (name: string, what: string, fn: () => Promise<{ ok: boolean; detail: string }>) => {
    const t0 = Date.now();
    try { const r = await fn(); probes.push({ name, what, ms: Date.now() - t0, ...r }); }
    catch (e) { probes.push({ name, what, ok: false, ms: Date.now() - t0, detail: e instanceof Error ? e.message : 'Unknown error' }); }
  };

  await timed('Connection', 'Reaches Google and the key is accepted', async () => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`);
    if (res.status === 403) {
      const body = await res.text().catch(() => '');
      if (/PERMISSION_DENIED|denied access/i.test(body)) {
        return {
          ok: false,
          detail:
            'Google has blocked the project behind this key ("PERMISSION_DENIED — your project has been denied access"). ' +
            'This is an account problem, not a CRM problem, and nothing in the code can work around it. ' +
            'Fix: go to aistudio.google.com/apikey, delete this key, and create a new one in a NEW project. ' +
            'Then replace GEMINI_API_KEY in Vercel and redeploy. ' +
            'It usually happens when a key is generated in a Cloud project that was suspended or never had the Generative Language API enabled.',
        };
      }
      return { ok: false, detail: `Key rejected (403). ${body.slice(0, 200)}` };
    }
    if (res.status === 400) return { ok: false, detail: 'Key rejected (400) — it is malformed. Generate a fresh key at aistudio.google.com/apikey.' };
    if (!res.ok) return { ok: false, detail: `Google returned HTTP ${res.status}.` };
    const d = (await res.json()) as { models?: Array<{ name: string }> };
    const names = (d.models ?? []).map((m) => m.name.replace('models/', ''));
    const has = names.some((n) => n === model || n.startsWith(model));
    return { ok: has, detail: has ? `Key valid · ${names.length} models available` : `Key valid, but "${model}" is not in your list of ${names.length} models.` };
  });

  await timed('Writing', 'Can generate text', async () => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with exactly: ALIVE' }] }], generationConfig: { temperature: 0, maxOutputTokens: 10 } }),
    });
    if (!res.ok) {
      // Show exactly what Google said. A generic "blocked at the project level"
      // hid the one sentence that explains which project and why.
      const raw = await res.text().catch(() => '');
      let reason = raw.slice(0, 300);
      try {
        const j = JSON.parse(raw) as { error?: { message?: string; status?: string } };
        if (j.error?.message) reason = `${j.error.status ?? res.status}: ${j.error.message}`;
      } catch { /* not JSON — the raw text is the best we have */ }
      return { ok: false, detail: `Google refused it — ${reason}` };
    }
    const d = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const t = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    return { ok: /ALIVE/i.test(t), detail: t ? `Replied "${t.slice(0, 40)}"` : 'Empty reply.' };
  });

  await timed('Reading payments', 'Pulls a UTR and amount out of a bank message', async () => {
    const sample = 'Dear Customer, Rs.3,50,000.00 has been debited from your Kotak A/c XX8556 on 05-01-2026 to SV ENTERPRISES via NEFT. UTR: KKBKN52026010500123456.';
    const r = await extractPaymentAdvice({ text: sample });
    if (!r) return { ok: false, detail: 'No usable reply came back.' };
    const amountOk = r.amount === 350000;
    const utrOk = r.utr === 'KKBKN52026010500123456';
    return { ok: amountOk && utrOk, detail: amountOk && utrOk ? `Read Rs.3,50,000 and the full UTR correctly` : `Amount read as ${r.amount ?? 'nothing'}, UTR as ${r.utr ?? 'nothing'}.` };
  });

  await timed('Search index', 'Can turn text into embeddings for document search', async () => {
    // Google renames embedding models over time, so try the known names in
    // order rather than hard-coding one that may have been retired.
    const tried: string[] = [];
    for (const name of EMBEDDING_MODELS) {
      tried.push(name);
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${name}:embedContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: `models/${name}`, content: { parts: [{ text: 'payment voucher' }] } }),
      });
      if (res.ok) {
        const d = (await res.json()) as { embedding?: { values?: number[] } };
        const n = d.embedding?.values?.length ?? 0;
        if (n > 0) return { ok: true, detail: `${n}-dimension vector from ${name}` };
      }
      if (res.status === 403) {
        const raw = await res.text().catch(() => '');
        return { ok: false, detail: `Google refused it — ${raw.slice(0, 220)}` };
      }
    }
    return { ok: false, detail: `None of these worked: ${tried.join(', ')}. Document Q&A stays off until one does.` };
  });

  return { enabled: true, model, provider: 'Google Gemini', probes };
}

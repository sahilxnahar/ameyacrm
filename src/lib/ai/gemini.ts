import 'server-only';
import { env } from '@/config/env';

export function isGeminiEnabled(): boolean {
  return Boolean(env.GEMINI_API_KEY);
}
export function geminiSupports(mimeType: string): boolean {
  return mimeType === 'application/pdf' || mimeType.startsWith('image/') || mimeType.startsWith('text/');
}

const BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  gif: 'image/gif', heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp', tiff: 'image/tiff',
  txt: 'text/plain', csv: 'text/csv', md: 'text/markdown', html: 'text/html',
};

/**
 * Work out the type from the filename when the browser will not say.
 *
 * Files dragged from some applications arrive with an empty type, or with
 * application/octet-stream. Rejecting those meant a perfectly readable PDF was
 * refused with a message claiming PDFs were supported.
 */
export function inferMimeType(reported: string, filename: string): string {
  const r = (reported || '').toLowerCase();
  if (r && r !== 'application/octet-stream' && r !== 'binary/octet-stream') return r;
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  return BY_EXTENSION[ext] ?? r ?? '';
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
      return { error: `The AI service refused the file (${res.status}). ${detail.slice(0, 160)}`.trim() };
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
export async function scoreLeadWithGemini(leadSummary: string): Promise<LeadScore | null> {
  if (!env.GEMINI_API_KEY) return null;
  const prompt =
    `You are a senior real-estate sales manager at a premium Bengaluru developer. Read the lead below and return: ` +
    `an integer "score" 0-100 for likelihood to book, a one-sentence "reason", and the single best "nextAction" for the rep. Be decisive.\n\nLEAD:\n` + leadSummary;
  const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, responseMimeType: 'application/json', responseSchema: LEAD_SCORE_SCHEMA } };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { error: `The AI service refused the file (${res.status}). ${detail.slice(0, 160)}`.trim() };
    }
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') ?? '';
    if (!raw) return { error: 'The AI read the file but found no billing data in it. Is this actually an invoice?' };
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
export async function analyzeCallRecording(audio: Buffer, mimeType: string): Promise<CallAnalysis | null> {
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
      return { error: `The AI service refused the file (${res.status}). ${detail.slice(0, 160)}`.trim() };
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

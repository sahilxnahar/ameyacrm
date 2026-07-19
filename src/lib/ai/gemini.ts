import 'server-only';
import { env } from '@/config/env';

export function isGeminiEnabled(): boolean {
  return Boolean(env.GEMINI_API_KEY);
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
export async function extractInvoiceData(buffer: Buffer, mimeType: string, filename: string): Promise<ExtractedBill | null> {
  if (!env.GEMINI_API_KEY || !geminiSupports(mimeType)) return null;
  if (buffer.length > 15 * 1024 * 1024) return null;
  const prompt =
    `Extract the billing / invoice data from the attached file "${filename}". Return the vendor or company name (clientName), ` +
    `their GST number (clientGstin), the invoice number, the invoice/purchase date as YYYY-MM-DD, and every line item ` +
    `(description, quantity, unit price as "rate", GST rate percent as "gstRate", and line total as "amount"). ` +
    `Also return subTotal (before GST), totalGst, and total (grand total including GST). Use null for anything not present. ` +
    `All monetary/numeric values must be plain numbers with no currency symbols or commas.`;
  const body = {
    contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: buffer.toString('base64') } }, { text: prompt }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: BILL_SCHEMA },
  };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) return null;
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') ?? '';
    if (!raw) return null;
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

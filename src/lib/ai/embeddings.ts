import 'server-only';
import { env } from '@/config/env';

/**
 * Embedding models, newest first.
 *
 * Google retires these. text-embedding-004 began returning 404 on keys created
 * in newer projects, which silently stopped every document being indexed — so
 * the first name that works is remembered rather than one being assumed.
 */
const MODELS = ['gemini-embedding-001', 'text-embedding-004', 'embedding-001'] as const;
let working: string | null = null;

/**
 * Gemini embeddings via the AI Studio key — free, no Cloud Console, no billing.
 * Returns null rather than throwing: a document that cannot be embedded should
 * still upload and still be summarised.
 */
export async function embed(text: string, kind: 'document' | 'query' = 'document'): Promise<number[] | null> {
  // A configured fallback provider takes precedence; it is only ever set on
  // purpose, and Google is the thing that stopped working.
  if (env.AI_BASE_URL && env.AI_API_KEY && env.AI_EMBED_MODEL) {
    const base = env.AI_BASE_URL.replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.AI_API_KEY}` },
        body: JSON.stringify({ model: env.AI_EMBED_MODEL, input: text.slice(0, 8000) }),
      });
      if (res.ok) {
        const j = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
        const v = j.data?.[0]?.embedding;
        if (v?.length) return v;
      }
    } catch { /* fall through to Google */ }
  }
  if (!env.GEMINI_API_KEY) return null;
  const clipped = text.slice(0, 8000);
  const order = working ? [working, ...MODELS.filter((m) => m !== working)] : [...MODELS];

  try {
    for (const model of order) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${model}`,
            content: { parts: [{ text: clipped }] },
            taskType: kind === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
          }),
        },
      );
      if (res.ok) {
        const d = (await res.json()) as { embedding?: { values?: number[] } };
        const values = d.embedding?.values ?? null;
        if (values?.length) { working = model; return values; }
      }
      // 404 means this name is gone — try the next. Anything else is a real
      // failure (no key, no quota, blocked project) and retrying will not help.
      if (res.status !== 404) return null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Embed several chunks, one at a time, tolerating individual failures. */
export async function embedMany(texts: string[]): Promise<Array<number[] | null>> {
  const out: Array<number[] | null> = [];
  for (const t of texts) {
    out.push(await embed(t));
    await new Promise((r) => setTimeout(r, 120)); // stay inside the free-tier rate limit
  }
  return out;
}

export function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    // Lengths are checked above, so these are present; reading them once keeps
    // the hot loop fast as well as provably safe.
    const x = a[i] as number;
    const y = b[i] as number;
    dot += x * y; na += x * x; nb += y * y;
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

/**
 * Split text on paragraph boundaries into overlapping windows. The overlap
 * matters: a clause split across two chunks would otherwise be answerable
 * from neither.
 */
export function chunkText(text: string, size = 1200, overlap = 200): string[] {
  const clean = text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (clean.length <= size) return clean ? [clean] : [];
  const paras = clean.split(/\n\n+/);
  const chunks: string[] = [];
  let cur = '';
  for (const p of paras) {
    if (cur.length + p.length + 2 > size && cur) {
      chunks.push(cur.trim());
      cur = cur.slice(Math.max(0, cur.length - overlap));
    }
    cur += (cur ? '\n\n' : '') + p;
    while (cur.length > size * 1.6) {          // a single enormous paragraph
      chunks.push(cur.slice(0, size).trim());
      cur = cur.slice(size - overlap);
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter((c) => c.length > 40);
}

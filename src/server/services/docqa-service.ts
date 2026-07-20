import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { embed, cosine, chunkText } from '@/lib/ai/embeddings';

export interface Source { title: string; snippet: string; documentId: string | null; fileObjectId: string | null; score: number }
export interface Answer { answer: string; sources: Source[]; searched: number }

/** Index one document's text. Replaces any previous chunks for it. */
export async function indexText(opts: {
  documentId?: string | null;
  fileObjectId?: string | null;
  title: string;
  source?: string | null;
  text: string;
}): Promise<number> {
  const chunks = chunkText(opts.text);
  if (!chunks.length) return 0;

  await prisma.docChunk.deleteMany({
    where: opts.documentId ? { documentId: opts.documentId } : { fileObjectId: opts.fileObjectId ?? '' },
  });

  let stored = 0;
  for (let i = 0; i < Math.min(chunks.length, 60); i++) {
    const vec = await embed(chunks[i]);
    if (!vec) continue;
    await prisma.docChunk.create({
      data: {
        documentId: opts.documentId ?? null,
        fileObjectId: opts.fileObjectId ?? null,
        title: opts.title.slice(0, 200),
        source: opts.source ?? null,
        ordinal: i,
        content: chunks[i],
        embedding: vec,
        tokens: Math.round(chunks[i].length / 4),
      },
    });
    stored++;
    await new Promise((r) => setTimeout(r, 120));
  }
  return stored;
}

/**
 * Answer from the indexed documents only. If nothing relevant is found the
 * answer says so — a confident invention about a penalty clause would be worse
 * than no answer at all.
 */
export async function askDocuments(question: string): Promise<Answer> {
  const q = question.trim();
  if (!q) return { answer: 'Ask a question about your documents.', sources: [], searched: 0 };

  const qvec = await embed(q, 'query');
  const chunks = await prisma.docChunk.findMany({
    select: { id: true, title: true, content: true, documentId: true, fileObjectId: true, embedding: true, source: true },
    take: 4000,
  });
  if (!chunks.length) {
    return { answer: 'No documents have been indexed yet. Open Documents and press "Index for search".', sources: [], searched: 0 };
  }

  let ranked: Array<{ c: (typeof chunks)[number]; score: number }>;
  if (qvec) {
    ranked = chunks.map((c) => ({ c, score: cosine(qvec, c.embedding) })).sort((a, b) => b.score - a.score);
  } else {
    // No AI key — fall back to plain keyword overlap so the feature still works.
    const words = q.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    ranked = chunks
      .map((c) => ({ c, score: words.filter((w) => c.content.toLowerCase().includes(w)).length / Math.max(1, words.length) }))
      .sort((a, b) => b.score - a.score);
  }

  const top = ranked.filter((r) => r.score > 0.25).slice(0, 6);
  if (!top.length) {
    return { answer: 'I could not find anything about that in the documents that have been indexed.', sources: [], searched: chunks.length };
  }

  const context = top.map((r, i) => `[${i + 1}] ${r.c.title}\n${r.c.content}`).join('\n\n---\n\n');
  const answer = await generate(q, context);

  return {
    answer,
    sources: top.map((r) => ({
      title: r.c.title,
      snippet: r.c.content.slice(0, 260),
      documentId: r.c.documentId,
      fileObjectId: r.c.fileObjectId,
      score: Math.round(r.score * 100),
    })),
    searched: chunks.length,
  };
}

async function generate(question: string, context: string): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    return 'Showing the closest passages below. Add a Gemini key to get them summarised into a direct answer.';
  }
  const prompt =
    'You answer questions for a Bengaluru real-estate developer using ONLY the extracts below. ' +
    'Quote the exact wording when it matters — clauses, amounts, dates. Cite the extract number in square brackets. ' +
    'If the extracts do not contain the answer, say so plainly and do not guess. Be brief and direct.\n\n' +
    `QUESTION: ${question}\n\nEXTRACTS:\n${context.slice(0, 24000)}`;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.15 } }),
      },
    );
    if (!res.ok) return 'The AI service did not respond. The matching passages are below.';
    const d = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return d.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || 'No answer came back. The matching passages are below.';
  } catch {
    return 'The AI service could not be reached. The matching passages are below.';
  }
}

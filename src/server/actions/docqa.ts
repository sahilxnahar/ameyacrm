'use server';
import { prisma } from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { indexText, askDocuments, type Answer, folderForFile } from '@/server/services/docqa-service';
import { env } from '@/config/env';

export type QaResult = { ok: true; data: Answer } | { error: string };
export type IndexResult = { ok: true; documents: number; chunks: number; message: string } | { error: string };

export async function ask(question: string): Promise<QaResult> {
  try {
    const ctx = await ensure('document.view');
    const data = await askDocuments(question, ctx);
    return { ok: true, data };
  } catch (err) { return toActionError(err); }
}

/**
 * Index whatever text we already hold — OCR output and AI summaries captured at
 * upload time. Nothing is re-read from storage, so this is quick and cheap.
 */
export async function indexAllDocuments(): Promise<IndexResult> {
  try {
    const ctx = await ensure('document.manage');
    const files = await prisma.fileObject.findMany({
      where: { ocrText: { not: null } },
      select: { id: true, originalName: true, ocrText: true },
      take: 200,
    });
    let docs = 0, chunks = 0;
    for (const f of files) {
      const n = await indexText({
        fileObjectId: f.id,
        title: f.originalName,
        source: 'Document library',
        text: f.ocrText ?? '',
        folderId: await folderForFile(f.id),
      });
      if (n > 0) { docs++; chunks += n; }
    }
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Document', summary: `Indexed ${docs} documents into ${chunks} passages` });
    revalidatePath('/ask');
    const note = env.GEMINI_API_KEY ? '' : ' No Gemini key is set, so search will fall back to keyword matching.';
    return {
      ok: true, documents: docs, chunks,
      message: docs === 0
        ? 'Nothing to index yet — documents become searchable once they have been read or summarised on upload.'
        : `${docs} documents indexed into ${chunks} searchable passages.${note}`,
    };
  } catch (err) { return toActionError(err); }
}

/** Draft a reply to a lead in the house tone. */
export async function draftReply(input: { leadId: string; channel: 'email' | 'whatsapp'; intent: string }): Promise<{ ok: true; text: string } | { error: string }> {
  try {
    await ensure('lead.view');
    if (!env.GEMINI_API_KEY) return { error: 'No Gemini key is configured, so drafting is unavailable.' };

    const lead = await prisma.lead.findUnique({
      where: { id: input.leadId },
      select: {
        name: true, requirement: true, budgetMin: true, budgetMax: true, status: true,
        temperature: true, locality: true, isNri: true,
        project: { select: { name: true, city: true } },
        activities: { orderBy: { occurredAt: 'desc' }, take: 4, select: { type: true, subject: true, notes: true } },
      },
    });
    if (!lead) return { error: 'Lead not found.' };

    const history = lead.activities.map((a) => `- ${a.type}: ${a.subject ?? ''} ${a.notes ?? ''}`).join('\n');
    const budget = lead.budgetMax ? `around Rs ${Number(lead.budgetMax).toLocaleString('en-IN')}` : 'not stated';

    const prompt = [
      'You write for a Bengaluru real-estate developer, Ameya Heights. Draft a reply to this buyer.',
      input.channel === 'whatsapp'
        ? 'Format: a WhatsApp message. Under 60 words, warm but businesslike, no bullet points, no emoji.'
        : 'Format: an email body only — no subject line, no signature block. Under 140 words, plain and courteous.',
      'Indian English. Never invent prices, dates, approvals or availability. If a fact is needed that you do not have, ask for it or offer to confirm.',
      '',
      `Buyer: ${lead.name}`,
      `Stage: ${lead.status} · interest: ${lead.temperature}${lead.isNri ? ' · NRI buyer' : ''}`,
      `Budget: ${budget}`,
      lead.requirement ? `Requirement: ${lead.requirement}` : '',
      lead.locality ? `Locality: ${lead.locality}` : '',
      lead.project ? `Project: ${lead.project.name}, ${lead.project.city}` : '',
      history ? `Recent history:\n${history}` : '',
      '',
      `What this reply must do: ${input.intent}`,
    ].filter(Boolean).join('\n');

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5 } }) },
    );
    if (!res.ok) return { error: 'The AI service did not respond. Try again in a moment.' };
    const d = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = d.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('')?.trim();
    if (!text) return { error: 'Nothing came back. Try rephrasing what the reply should do.' };
    return { ok: true, text };
  } catch (err) { return toActionError(err); }
}

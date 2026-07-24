'use server';
import { getActionContext, ensure, toActionError } from './_helpers';
import { aiReadFile, activeProvider } from '@/lib/ai/provider';
import { getFolderTree } from '@/server/services/folder-access-service';
import { uploadDocument } from './documents';

export type AssistantFileResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

const MAX_BYTES = 10 * 1024 * 1024; // stays under the 10mb server-action limit

const READABLE = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

const FILE_SYSTEM = [
  'You are the built-in assistant inside the Ameya Heights CRM — an Indian real-estate developer\'s CRM & ERP.',
  'The user has attached a document (a bill, a scan, a letter, an agreement or similar).',
  'Read it and answer their question about it clearly and concisely.',
  'If they asked nothing specific, give a short, useful summary: what the document is, who it is from, key dates, amounts (in ₹) and anything that needs action.',
  'Use Indian context (₹, lakhs/crores, RERA, GST) where relevant. Never invent details that are not in the document — if something is unclear or missing, say so.',
].join(' ');

/**
 * Ask the assistant about an attached file. Reads the document with the same
 * multimodal path the bill-reader uses (OpenRouter file-parser / image), so no
 * new AI plumbing — it rides the existing key rotation and fallbacks.
 */
export async function askAssistantAboutFile(formData: FormData): Promise<AssistantFileResult> {
  try {
    await getActionContext();

    const provider = activeProvider();
    if (provider.kind === 'none') {
      return { ok: false, error: 'The assistant isn’t switched on yet. Add an AI key in Vercel and redeploy.' };
    }
    if (!provider.multimodal) {
      return { ok: false, error: `${provider.label} reads text only. Reading attachments needs OpenRouter (set AI_BASE_URL to OpenRouter) or Google.` };
    }

    const file = formData.get('file');
    const question = String(formData.get('question') || '').trim();
    if (!(file instanceof File)) return { ok: false, error: 'Attach a file first.' };
    if (file.size === 0) return { ok: false, error: 'That file looks empty.' };
    if (file.size > MAX_BYTES) return { ok: false, error: 'That file is over 10MB. Please attach a smaller one, or upload it in Documents.' };

    const mime = file.type || 'application/octet-stream';
    if (!READABLE.has(mime)) {
      return { ok: false, error: 'I can read PDFs and images (PNG/JPG). For other file types, please add them in Documents.' };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const prompt = question
      ? `The user asks: ${question}`
      : 'Summarise this document and flag anything that needs action.';

    const r = await aiReadFile({ buffer, mimeType: mime, filename: file.name }, prompt, { system: FILE_SYSTEM });
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, text: r.text.trim() };
  } catch (e) {
    return { ok: false, error: toActionError(e).error };
  }
}

export type FilingFolder = { id: string; name: string; depth: number };

/**
 * The folders the assistant can file a document into — only the ones this
 * person is allowed to open. Names are indented so the tree is legible in a
 * flat list.
 */
export async function listFilingFolders(): Promise<{ folders: FilingFolder[] }> {
  try {
    const ctx = await getActionContext();
    const tree = await getFolderTree(ctx);
    const open = tree.filter((f) => f.canOpen);
    const byId = new Map(open.map((f) => [f.id, f]));
    const depthOf = (id: string): number => {
      let d = 0;
      let cur = byId.get(id)?.parentId ?? null;
      for (let i = 0; i < 8 && cur; i++) { d++; cur = byId.get(cur)?.parentId ?? null; }
      return d;
    };
    const folders = open
      .map((f) => ({ id: f.id, name: f.name, depth: depthOf(f.id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { folders };
  } catch {
    return { folders: [] };
  }
}

export type FileDocResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * File the attached document into a folder — the "where should this go?" step.
 * Reuses the normal document upload path, so the file is stored, summarised and
 * mirrored to Drive exactly like any other document.
 */
export async function fileAssistantDocument(formData: FormData): Promise<FileDocResult> {
  try {
    await ensure('document.create');
    const folderId = String(formData.get('folderId') || '');
    if (!folderId) return { ok: false, error: 'Choose a folder.' };
    const r = await uploadDocument(formData);
    if ('error' in r) return { ok: false, error: r.error };
    return { ok: true, id: r.id };
  } catch (e) {
    return { ok: false, error: toActionError(e).error };
  }
}

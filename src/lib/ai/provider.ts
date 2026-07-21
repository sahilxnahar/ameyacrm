import 'server-only';
import { env } from '@/config/env';

/**
 * Where the AI actually runs.
 *
 * Google denied this deployment's project access to the Gemini API — not the
 * key, not the CRM, the account. Nothing here could route around it, so the
 * CRM now speaks to a second provider as well and picks whichever is working.
 *
 * The fallback speaks the OpenAI chat-completions shape, which OpenRouter,
 * Groq, OpenAI, Together, Mistral and DeepInfra all implement identically.
 * One base URL and one key switches provider; no code changes.
 */
export type ProviderKind = 'gemini' | 'openai-compatible' | 'none';

export interface ProviderInfo {
  kind: ProviderKind;
  label: string;
  model: string;
  /** Whether it can read a PDF or an image, not just text. */
  multimodal: boolean;
  embeddings: boolean;
}

export function activeProvider(): ProviderInfo {
  if (env.AI_BASE_URL && env.AI_API_KEY) {
    const host = (() => { try { return new URL(env.AI_BASE_URL!).hostname; } catch { return env.AI_BASE_URL!; } })();
    // OpenRouter parses PDFs and images for ANY model it serves, using its own
    // file-parser. Groq and most other gateways do not, so this is claimed only
    // where it is actually true.
    const supportsFiles = /openrouter\.ai/i.test(env.AI_BASE_URL ?? '');
    return {
      kind: 'openai-compatible',
      label: host.replace(/^api\./, ''),
      model: env.AI_MODEL ?? 'not set',
      multimodal: supportsFiles,
      embeddings: Boolean(env.AI_EMBED_MODEL),
    };
  }
  if (env.GEMINI_API_KEY) {
    return { kind: 'gemini', label: 'Google Gemini', model: env.GEMINI_MODEL, multimodal: true, embeddings: true };
  }
  return { kind: 'none', label: 'not configured', model: '—', multimodal: false, embeddings: false };
}

export interface ChatOptions {
  prompt: string;
  system?: string;
  /** Ask for JSON back. Both providers support this, by different means. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export type ChatResult = { ok: true; text: string } | { ok: false; error: string };

/**
 * Ask the configured provider for text. Tries the fallback provider first when
 * one is set, because it is only ever set deliberately.
 */
export async function aiChat(opts: ChatOptions): Promise<ChatResult> {
  const p = activeProvider();
  if (p.kind === 'none') return { ok: false, error: 'No AI provider is configured.' };
  if (p.kind === 'openai-compatible') return openAiChat(opts);
  return geminiChat(opts);
}

async function openAiChat(opts: ChatOptions): Promise<ChatResult> {
  const base = (env.AI_BASE_URL ?? '').replace(/\/$/, '');
  const messages: Array<{ role: string; content: string }> = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: opts.prompt });

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.AI_API_KEY}`,
        // OpenRouter asks for these; everyone else ignores them.
        'HTTP-Referer': env.APP_URL,
        'X-Title': 'Ameya Heights CRM',
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 900,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    const raw = await res.text();
    if (!res.ok) {
      let reason = raw.slice(0, 250);
      try {
        const j = JSON.parse(raw) as { error?: { message?: string } };
        if (j.error?.message) reason = j.error.message;
      } catch { /* raw text is the best we have */ }
      return { ok: false, error: `${new URL(base).hostname} refused it (HTTP ${res.status}) — ${reason}` };
    }
    const j = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
    const text = j.choices?.[0]?.message?.content?.trim() ?? '';
    return text ? { ok: true, text } : { ok: false, error: 'The provider returned an empty reply.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'The request failed.' };
  }
}

async function geminiChat(opts: ChatOptions): Promise<ChatResult> {
  const prompt = opts.system ? `${opts.system}\n\n${opts.prompt}` : opts.prompt;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: opts.temperature ?? 0.2,
            maxOutputTokens: opts.maxTokens ?? 900,
            ...(opts.json ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      },
    );
    const raw = await res.text();
    if (!res.ok) {
      let reason = raw.slice(0, 250);
      try {
        const j = JSON.parse(raw) as { error?: { message?: string; status?: string } };
        if (j.error?.message) reason = `${j.error.status ?? res.status}: ${j.error.message}`;
      } catch { /* raw text is the best we have */ }
      return { ok: false, error: `Google refused it — ${reason}` };
    }
    const j = JSON.parse(raw) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = j.candidates?.[0]?.content?.parts?.map((x) => x.text).filter(Boolean).join('').trim() ?? '';
    return text ? { ok: true, text } : { ok: false, error: 'Gemini returned an empty reply.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'The request failed.' };
  }
}

/** Embeddings from whichever provider is configured. Null on any problem. */
export async function aiEmbed(text: string, kind: 'document' | 'query' = 'document'): Promise<number[] | null> {
  const p = activeProvider();
  const clipped = text.slice(0, 8000);

  if (p.kind === 'openai-compatible' && env.AI_EMBED_MODEL) {
    const base = (env.AI_BASE_URL ?? '').replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.AI_API_KEY}` },
        body: JSON.stringify({ model: env.AI_EMBED_MODEL, input: clipped }),
      });
      if (!res.ok) return null;
      const j = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
      return j.data?.[0]?.embedding ?? null;
    } catch {
      return null;
    }
  }

  if (p.kind === 'gemini') {
    const { embed } = await import('@/lib/ai/embeddings');
    return embed(clipped, kind);
  }
  return null;
}


export interface Attachment { buffer: Buffer; mimeType: string; filename: string }

/**
 * Ask about a file — a bill, a scan, a photo.
 *
 * OpenRouter accepts PDFs and images for any model it serves: images as
 * data URLs, PDFs through its file-parser. The `cloudflare-ai` engine is free
 * and converts a PDF to markdown, which is all the CRM needs — `mistral-ocr`
 * is better for photographed documents but is charged per page.
 */
export async function aiReadFile(
  file: Attachment,
  prompt: string,
  opts: { system?: string; json?: boolean; maxTokens?: number } = {},
): Promise<ChatResult> {
  const p = activeProvider();
  if (p.kind !== 'openai-compatible' || !p.multimodal) {
    return { ok: false, error: `${p.label} reads text only. Reading files needs OpenRouter or Google.` };
  }

  const base = (env.AI_BASE_URL ?? '').replace(/\/$/, '');
  const dataUrl = `data:${file.mimeType};base64,${file.buffer.toString('base64')}`;
  const isPdf = file.mimeType === 'application/pdf';

  const content: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }];
  content.push(
    isPdf
      ? { type: 'file', file: { filename: file.filename, file_data: dataUrl } }
      : { type: 'image_url', image_url: { url: dataUrl } },
  );

  const messages: Array<Record<string, unknown>> = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content });

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.AI_API_KEY}`,
        'HTTP-Referer': env.APP_URL,
        'X-Title': 'Ameya Heights CRM',
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        messages,
        temperature: 0,
        max_tokens: opts.maxTokens ?? 1200,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        // Free engine. Costs nothing and handles a normal digital PDF well.
        ...(isPdf ? { plugins: [{ id: 'file-parser', pdf: { engine: 'cloudflare-ai' } }] } : {}),
      }),
    });
    const raw = await res.text();
    if (!res.ok) {
      let reason = raw.slice(0, 250);
      try {
        const j = JSON.parse(raw) as { error?: { message?: string } };
        if (j.error?.message) reason = j.error.message;
      } catch { /* raw text is the best we have */ }
      return { ok: false, error: `${p.label} refused it (HTTP ${res.status}) — ${reason}` };
    }
    const j = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
    const text = j.choices?.[0]?.message?.content?.trim() ?? '';
    return text ? { ok: true, text } : { ok: false, error: 'The provider read the file but said nothing.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'The request failed.' };
  }
}

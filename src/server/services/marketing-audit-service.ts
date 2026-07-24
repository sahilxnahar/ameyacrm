import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { readPage, type PageSignals } from '@/lib/marketing/page-signals';
import { aiChat, activeProvider } from '@/lib/ai/provider';
import type { AuditKind, AuditResult, Finding } from '@/config/marketing-audits';

export type { AuditKind, AuditResult, Finding };




/** What each audit asks the model to do, and what it must return. */
function promptFor(kind: AuditKind, a: PageSignals, b: PageSignals | null): { system: string; user: string } {
  const facts = (p: PageSignals) => JSON.stringify({
    url: p.url, title: p.title, description: p.metaDescription, h1: p.h1, h2: p.h2,
    words: p.wordCount, images: p.images, imagesMissingAlt: p.imagesMissingAlt,
    ctas: p.ctas, schemaTypes: p.schemaTypes, hasFaq: p.hasFaqSchema,
    hasLocalBusiness: p.hasLocalBusiness, hasForm: p.hasForm, phones: p.phones.length,
    canonical: Boolean(p.canonical), ogImage: Boolean(p.ogImage),
    text: p.text.slice(0, 6000),
  });

  const shape =
    'Reply with JSON only: {"score": 0-100, "summary": "two sentences", ' +
    '"findings": [{"severity":"high|medium|low","title":"short","detail":"what is wrong and why it matters","fix":"exactly what to change"}]}. ' +
    'Between 4 and 8 findings, most important first. Be specific to this page — quote its actual words. ' +
    'No generic advice that would apply to any website.';

  const base =
    'You are auditing the website of an Indian real-estate developer selling residential property in Bangalore. ' +
    'The audience is buyers spending one to three crore, and NRIs. Judge it on that, not on SaaS marketing conventions.';

  switch (kind) {
    case 'LANDING':
      return {
        system: `${base} You assess whether a page persuades a serious buyer to make contact. ${shape}`,
        user: `Audit this landing page.\n\n${facts(a)}`,
      };
    case 'SEO':
      return {
        system: `${base} You assess technical and on-page SEO: title, description, headings, structure, internal linking, image alt text, schema. ${shape}`,
        user: `Audit this page for search.\n\n${facts(a)}`,
      };
    case 'AEO':
      return {
        system:
          `${base} You assess Answer Engine Optimisation — whether an AI assistant (ChatGPT, Gemini, Perplexity) could confidently cite this ` +
          'business when asked "who are good builders in Bangalore" or "tell me about Ameya Heights". That needs: unambiguous entity facts ' +
          '(legal name, address, phone, RERA), question-and-answer content, FAQ and Organization schema, plain factual statements rather ' +
          `than marketing adjectives, and content that can be quoted in isolation. ${shape}`,
        user: `Audit this page for AI answer engines.\n\n${facts(a)}`,
      };
    case 'COMPETITORS':
      return {
        system:
          `${base} You compare two developers' pages and find where ours is weaker, where it is stronger, and what is worth copying. ` +
          'Be concrete about wording, offers and proof. ' +
          'Reply with JSON only: {"score": 0-100 (how we compare), "summary": "two sentences", ' +
          '"findings": [{"severity":"high|medium|low","title":"short","detail":"the difference","fix":"what to do about it"}], ' +
          '"output": {"theyDoBetter": ["..."], "weDoBetter": ["..."], "steal": ["..."]}}',
        user: `OURS:\n${facts(a)}\n\nTHEIRS:\n${facts(b!)}`,
      };
    case 'ADS':
      return {
        system:
          `${base} You write ad copy from what the page actually says — never invent a claim, a price or an amenity that is not there. ` +
          'Indian property advertising forbids "guaranteed" and "assured returns". ' +
          'Reply with JSON only: {"score": null, "summary": "one sentence on the angle you took", "findings": [], ' +
          '"output": {"google": [{"headline":"max 30 chars","description":"max 90 chars"}], ' +
          '"meta": [{"headline":"max 40 chars","body":"max 125 chars"}]}}. ' +
          'Three Google variants and three Meta variants. Count characters carefully — they are hard limits.',
        user: `Write ads for this page.\n\n${facts(a)}`,
      };
  }
}

/** Run one audit and store it. */
export async function runAudit(
  kind: AuditKind,
  url: string,
  opts: { compareTo?: string; userId?: string } = {},
): Promise<AuditResult> {
  const provider = activeProvider();
  const page = await readPage(url);

  if ('error' in page) return store(kind, url, null, { error: page.error });

  let rival: PageSignals | null = null;
  if (kind === 'COMPETITORS') {
    if (!opts.compareTo) return store(kind, url, page, { error: 'Give me a competitor URL to compare against.' });
    const other = await readPage(opts.compareTo);
    if ('error' in other) return store(kind, url, page, { error: `Could not read the competitor: ${other.error}` });
    rival = other;
  }

  if (provider.kind === 'none') return store(kind, url, page, { error: 'No AI provider is configured.' });

  const { system, user } = promptFor(kind, page, rival);
  const r = await aiChat({ system, prompt: user, json: true, temperature: 0.3, maxTokens: 1600 });
  if (!r.ok) return store(kind, url, page, { error: r.error });

  try {
    const parsed = JSON.parse(r.text.replace(/^```(?:json)?|```$/g, '').trim()) as {
      score?: unknown; summary?: unknown; findings?: unknown; output?: unknown;
    };
    const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : null;
    const findings = Array.isArray(parsed.findings)
      ? (parsed.findings as Record<string, unknown>[]).slice(0, 10).map((f) => ({
          severity: (['high', 'medium', 'low'].includes(String(f.severity)) ? f.severity : 'medium') as Finding['severity'],
          title: String(f.title ?? 'Finding').slice(0, 160),
          detail: String(f.detail ?? '').slice(0, 800),
          fix: String(f.fix ?? '').slice(0, 800),
        }))
      : [];
    return store(kind, url, page, {
      score, summary: String(parsed.summary ?? '').slice(0, 600),
      findings, output: parsed.output ?? null, model: provider.model,
    });
  } catch {
    return store(kind, url, page, { error: 'The AI replied with something I could not read. Try again.' });
  }
}

async function store(
  kind: AuditKind,
  url: string,
  signals: PageSignals | null,
  data: { score?: number | null; summary?: string; findings?: Finding[]; output?: unknown; model?: string; error?: string },
): Promise<AuditResult> {
  let hostname = url;
  try { hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname; } catch { /* keep the raw string */ }

  const row = await prisma.marketingAudit.create({
    data: {
      kind, url, hostname,
      score: data.score ?? null,
      summary: data.summary ?? null,
      findings: (data.findings ?? []) as object,
      output: (data.output ?? null) as object,
      signals: (signals ?? null) as object,
      model: data.model ?? null,
      error: data.error ?? null,
    },
    select: { id: true },
  });

  return {
    id: row.id, kind, url,
    score: data.score ?? null,
    summary: data.summary ?? '',
    findings: data.findings ?? [],
    output: data.output ?? null,
    error: data.error ?? null,
  };
}

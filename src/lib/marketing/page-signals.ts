/**
 * Pull the marketing-relevant facts out of a web page.
 *
 * Deliberately regex over raw HTML rather than a DOM library: this runs in a
 * serverless function where a headless browser is not an option, and every
 * signal below survives in the source anyway.
 */
export interface PageSignals {
  url: string;
  status: number;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  ogTitle: string | null;
  ogImage: string | null;
  h1: string[];
  h2: string[];
  wordCount: number;
  text: string;
  images: number;
  imagesMissingAlt: number;
  internalLinks: number;
  externalLinks: number;
  /** Anything that reads like a call to action. */
  ctas: string[];
  hasStructuredData: boolean;
  schemaTypes: string[];
  hasFaqSchema: boolean;
  hasOrganisation: boolean;
  hasLocalBusiness: boolean;
  phones: string[];
  emails: string[];
  hasForm: boolean;
  viewportMeta: boolean;
  langAttr: string | null;
  bytes: number;
}

const strip = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const attr = (tag: string, name: string): string | null =>
  tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1]?.trim() ?? null;

const metaBy = (html: string, key: 'name' | 'property', value: string): string | null => {
  const re = new RegExp(`<meta[^>]*${key}\\s*=\\s*["']${value}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  return tag ? attr(tag, 'content') : null;
};

const allOf = (html: string, tag: string): string[] =>
  [...html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))]
    .map((m) => strip(m[1] ?? ''))
    .filter(Boolean);

/** Fetch a page and reduce it to the things a marketer would look at. */
export async function readPage(rawUrl: string, timeoutMs = 15000): Promise<PageSignals | { error: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
  } catch {
    return { error: `"${rawUrl}" is not a web address I can read.` };
  }
  if (!/^https?:$/.test(url.protocol)) return { error: 'Only http and https addresses can be checked.' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Identify honestly; some sites block unknown agents outright.
        'User-Agent': 'AmeyaHeightsCRM/1.0 (+https://crm.ameyaheights.com) marketing-audit',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const html = await res.text();
    if (!res.ok) return { error: `${url.hostname} replied ${res.status}. The page could not be read.` };
    if (!html || html.length < 200) return { error: `${url.hostname} returned almost nothing — it may need JavaScript to render.` };

    const text = strip(html);
    const imgTags = [...html.matchAll(/<img[^>]*>/gi)].map((m) => m[0]);
    const links = [...html.matchAll(/<a[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)].map((m) => m[1] ?? '');
    const ldBlocks = [...html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
      .map((m) => m[1] ?? '');

    const schemaTypes = new Set<string>();
    for (const block of ldBlocks) {
      for (const t of block.matchAll(/"@type"\s*:\s*"([^"]+)"/g)) if (t[1]) schemaTypes.add(t[1]);
    }

    const ctaWords = /\b(book|enquire|enquiry|contact|call|schedule|visit|download|get in touch|request|register|brochure|site visit|talk to)\b/i;
    const ctas = [
      ...[...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)].map((m) => strip(m[1] ?? '')),
      ...links.map((_, i) => strip([...html.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)][i]?.[1] ?? '')),
    ].filter((t) => t && t.length < 60 && ctaWords.test(t));

    return {
      url: url.toString(),
      status: res.status,
      title: allOf(html, 'title')[0] ?? null,
      metaDescription: metaBy(html, 'name', 'description'),
      canonical: (() => {
        const tag = html.match(/<link[^>]*rel\s*=\s*["']canonical["'][^>]*>/i)?.[0];
        return tag ? attr(tag, 'href') : null;
      })(),
      ogTitle: metaBy(html, 'property', 'og:title'),
      ogImage: metaBy(html, 'property', 'og:image'),
      h1: allOf(html, 'h1'),
      h2: allOf(html, 'h2').slice(0, 20),
      wordCount: text.split(/\s+/).filter(Boolean).length,
      text: text.slice(0, 12000),
      images: imgTags.length,
      imagesMissingAlt: imgTags.filter((t) => !/alt\s*=\s*["'][^"']+["']/i.test(t)).length,
      internalLinks: links.filter((h) => h.startsWith('/') || h.includes(url.hostname)).length,
      externalLinks: links.filter((h) => /^https?:\/\//i.test(h) && !h.includes(url.hostname)).length,
      ctas: [...new Set(ctas)].slice(0, 12),
      hasStructuredData: ldBlocks.length > 0,
      schemaTypes: [...schemaTypes],
      hasFaqSchema: [...schemaTypes].some((t) => /FAQ|Question/i.test(t)),
      hasOrganisation: [...schemaTypes].some((t) => /Organization|Corporation/i.test(t)),
      hasLocalBusiness: [...schemaTypes].some((t) => /LocalBusiness|RealEstate/i.test(t)),
      phones: [...new Set((text.match(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g) ?? []))].slice(0, 5),
      emails: [...new Set((text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []))].slice(0, 5),
      hasForm: /<form[\s>]/i.test(html),
      viewportMeta: /<meta[^>]*name\s*=\s*["']viewport["']/i.test(html),
      langAttr: html.match(/<html[^>]*lang\s*=\s*["']([^"']+)["']/i)?.[1] ?? null,
      bytes: html.length,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return { error: /abort/i.test(msg) ? `${url.hostname} took too long to answer.` : `Could not reach ${url.hostname}: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

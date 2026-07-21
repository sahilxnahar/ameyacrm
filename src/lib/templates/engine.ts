import { MERGE_TOKENS, SAMPLE_VALUES } from '@/config/merge-fields';

export interface TemplateInput {
  key: string;
  channel: string;
  category?: string | null;
  subject?: string | null;
  header?: string | null;
  body: string;
  footer?: string | null;
  buttons?: Array<{ type: 'QUICK_REPLY' | 'URL'; text: string; url?: string }> | null;
}

export interface Issue { level: 'error' | 'warning'; field: string; message: string }

/** Every {{token}} used, in order of first appearance. */
export function tokensIn(text: string): string[] {
  const out: string[] = [];
  for (const m of (text ?? '').matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)) {
    const t = m[1];
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** Fill a template with real values. Unknown tokens are left visible on purpose. */
export function render(text: string, values: Record<string, string>): string {
  return (text ?? '').replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (whole, token: string) => values[token] ?? whole);
}

/** What the message will look like to the person receiving it. */
export function preview(t: TemplateInput): { subject: string | null; header: string | null; body: string; footer: string | null } {
  return {
    subject: t.subject ? render(t.subject, SAMPLE_VALUES) : null,
    header: t.header ? render(t.header, SAMPLE_VALUES) : null,
    body: render(t.body, SAMPLE_VALUES),
    footer: t.footer ? render(t.footer, SAMPLE_VALUES) : null,
  };
}

/** SMS is billed per 160-character segment (70 if it contains non-Latin text). */
export function smsSegments(text: string): { chars: number; segments: number; unicode: boolean } {
  const rendered = render(text, SAMPLE_VALUES);
  const unicode = /[^\x00-\x7F]/.test(rendered);
  const size = unicode ? 70 : 160;
  return { chars: rendered.length, segments: Math.max(1, Math.ceil(rendered.length / size)), unicode };
}

/**
 * Check a template before it is saved — and, for WhatsApp, before it is sent to
 * Meta. Meta's review takes hours to days and a rejection costs that whole
 * round trip, so every rule they publish is checked here first.
 */
export function validate(t: TemplateInput): Issue[] {
  const issues: Issue[] = [];
  const body = (t.body ?? '').trim();

  if (!body) issues.push({ level: 'error', field: 'body', message: 'The message is empty.' });

  for (const token of [...tokensIn(body), ...tokensIn(t.header ?? ''), ...tokensIn(t.footer ?? ''), ...tokensIn(t.subject ?? '')]) {
    if (!MERGE_TOKENS.has(token)) {
      issues.push({ level: 'error', field: 'body', message: `{{${token}}} is not a field the CRM can fill. Pick one from the list, or it will send literally.` });
    }
  }

  if (t.channel === 'WHATSAPP') {
    if (!/^[a-z0-9_]{1,512}$/.test(t.key)) {
      issues.push({ level: 'error', field: 'key', message: 'Meta only accepts lowercase letters, numbers and underscores in a template name.' });
    }
    if (!t.category) {
      issues.push({ level: 'error', field: 'category', message: 'Meta requires a category. Utility is right for payment reminders and receipts.' });
    }
    if (body.length > 1024) {
      issues.push({ level: 'error', field: 'body', message: `The message is ${body.length} characters. Meta's limit is 1024.` });
    }
    if ((t.header ?? '').length > 60) {
      issues.push({ level: 'error', field: 'header', message: "Meta's header limit is 60 characters." });
    }
    if ((t.footer ?? '').length > 60) {
      issues.push({ level: 'error', field: 'footer', message: "Meta's footer limit is 60 characters." });
    }
    // Meta rejects a body that opens or closes on a variable, or has two together.
    if (/^\s*\{\{/.test(body)) {
      issues.push({ level: 'error', field: 'body', message: 'Meta rejects a message that starts with a variable. Put a word before it.' });
    }
    if (/\}\}\s*$/.test(body)) {
      issues.push({ level: 'error', field: 'body', message: 'Meta rejects a message that ends with a variable. Add a closing line.' });
    }
    if (/\}\}[\s,.]*\{\{/.test(body)) {
      issues.push({ level: 'error', field: 'body', message: 'Two variables cannot sit next to each other. Put words between them.' });
    }
    if (t.category === 'MARKETING' && !/opt|stop|unsubscribe/i.test(`${body} ${t.footer ?? ''}`)) {
      issues.push({ level: 'warning', field: 'footer', message: 'Marketing templates are approved more readily with an opt-out line in the footer.' });
    }
    if (/\n{3,}/.test(body)) {
      issues.push({ level: 'warning', field: 'body', message: 'Several blank lines in a row are often rejected as formatting abuse.' });
    }
    for (const b of t.buttons ?? []) {
      if (b.type === 'URL' && !/^https?:\/\//.test(b.url ?? '')) {
        issues.push({ level: 'error', field: 'buttons', message: `Button "${b.text}" needs a full URL starting with https://.` });
      }
      if (b.text.length > 25) {
        issues.push({ level: 'error', field: 'buttons', message: `Button text "${b.text}" is over Meta's 25-character limit.` });
      }
    }
  }

  if (t.channel === 'EMAIL' && !(t.subject ?? '').trim()) {
    issues.push({ level: 'error', field: 'subject', message: 'An email needs a subject.' });
  }
  if (t.channel === 'SMS') {
    const s = smsSegments(body);
    if (s.segments > 3) {
      issues.push({ level: 'warning', field: 'body', message: `This is ${s.segments} SMS segments (${s.chars} characters) and will be billed as ${s.segments} messages.` });
    }
    if (s.unicode) {
      issues.push({ level: 'warning', field: 'body', message: 'Non-English characters cut the limit from 160 to 70 characters per segment.' });
    }
  }
  return issues;
}

/**
 * Meta does not accept named variables — only {{1}}, {{2}} in order, with an
 * example for each. This converts our readable template into their shape and
 * keeps the mapping so values can be filled back in when sending.
 */
export function toMetaPayload(t: TemplateInput, language = 'en'): { payload: Record<string, unknown>; mapping: string[] } {
  const mapping = tokensIn(t.body);
  const positional = (text: string, tokens: string[]) =>
    text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (whole, token: string) => {
      const i = tokens.indexOf(token);
      return i === -1 ? whole : `{{${i + 1}}}`;
    });

  const components: Array<Record<string, unknown>> = [];

  if (t.header) {
    const headerTokens = tokensIn(t.header);
    const c: Record<string, unknown> = { type: 'HEADER', format: 'TEXT', text: positional(t.header, headerTokens) };
    if (headerTokens.length) c.example = { header_text: headerTokens.map((x) => SAMPLE_VALUES[x] ?? x) };
    components.push(c);
  }

  const bodyComponent: Record<string, unknown> = { type: 'BODY', text: positional(t.body, mapping) };
  if (mapping.length) bodyComponent.example = { body_text: [mapping.map((x) => SAMPLE_VALUES[x] ?? x)] };
  components.push(bodyComponent);

  if (t.footer) components.push({ type: 'FOOTER', text: render(t.footer, SAMPLE_VALUES) });

  if (t.buttons?.length) {
    components.push({
      type: 'BUTTONS',
      buttons: t.buttons.map((b) =>
        b.type === 'URL' ? { type: 'URL', text: b.text, url: b.url } : { type: 'QUICK_REPLY', text: b.text },
      ),
    });
  }

  return {
    payload: { name: t.key, language, category: t.category ?? 'UTILITY', components },
    mapping,
  };
}

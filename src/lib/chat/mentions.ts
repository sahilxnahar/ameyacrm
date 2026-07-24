/**
 * @mention parsing, kept pure and testable. A message can name people by their
 * username with `@handle`; this pulls the handles out so the sender-side can
 * notify them, and the reader-side can render them as chips.
 */
export function parseMentions(body: string): string[] {
  const out = new Set<string>();
  const re = /(^|[^\w@])@([a-zA-Z0-9._-]{2,32})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m[2]) out.add(m[2].toLowerCase());
  }
  return [...out];
}

/** Split a message into text and mention tokens so the UI can render chips. */
export type Segment = { type: 'text'; value: string } | { type: 'mention'; handle: string };
export function segmentMessage(body: string): Segment[] {
  const segments: Segment[] = [];
  const re = /(^|[^\w@])@([a-zA-Z0-9._-]{2,32})/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const lead = m[1] ?? '';
    const start = m.index + lead.length;
    if (start > last) segments.push({ type: 'text', value: body.slice(last, start) });
    segments.push({ type: 'mention', handle: m[2]! });
    last = start + 1 + (m[2]?.length ?? 0);
  }
  if (last < body.length) segments.push({ type: 'text', value: body.slice(last) });
  return segments;
}

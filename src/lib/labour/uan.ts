/**
 * EPF/ESI UAN validation (module #68). A Universal Account Number is a 12-digit
 * numeric identifier. This is the in-app format gate that runs at the security
 * checkpoint before a live EPFO/GSP confirmation; a malformed UAN is rejected
 * instantly without any network call. Pure + unit-tested.
 */
export function normaliseUan(raw: string): string {
  return (raw ?? '').replace(/[\s-]/g, '');
}

export function isValidUanFormat(raw: string): boolean {
  const u = normaliseUan(raw);
  return /^\d{12}$/.test(u);
}

/** Parse a pasted block (one UAN per line, optional "name, uan") into rows. */
export interface ParsedUan { workerName: string; uan: string; validFormat: boolean }
export function parseUanBlock(text: string): ParsedUan[] {
  const out: ParsedUan[] = [];
  for (const line of (text ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Accept "Name, 123456789012" | "Name 123456789012" | "123456789012"
    const parts = trimmed.split(/[,\t]/).map((p) => p.trim()).filter(Boolean);
    let workerName = 'Worker', uan = '';
    if (parts.length >= 2) { workerName = parts[0] ?? 'Worker'; uan = parts[1] ?? ''; }
    else {
      const m = trimmed.match(/(\d[\d\s-]{10,}\d)\s*$/);
      if (m) { uan = m[1] ?? ''; workerName = trimmed.slice(0, trimmed.length - (m[1]?.length ?? 0)).trim() || 'Worker'; }
      else { uan = trimmed; }
    }
    const clean = normaliseUan(uan);
    out.push({ workerName, uan: clean, validFormat: isValidUanFormat(clean) });
  }
  return out;
}

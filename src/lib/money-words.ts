/**
 * Rupees in words, Indian style (lakh / crore) — a receipt is not a legal
 * document without it, and every accountant in the country expects it.
 */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function under100(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  return n % 10 ? `${t} ${ONES[n % 10]}` : t;
}
function under1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? under100(r) : ''].filter(Boolean).join(' ');
}

export function rupeesInWords(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const whole = Math.floor(abs);
  const paise = Math.round((abs - whole) * 100);

  const parts: string[] = [];
  const crore = Math.floor(whole / 10000000);
  const lakh = Math.floor((whole % 10000000) / 100000);
  const thousand = Math.floor((whole % 100000) / 1000);
  const rest = whole % 1000;

  if (crore) parts.push(`${under1000(crore)} Crore`);
  if (lakh) parts.push(`${under1000(lakh)} Lakh`);
  if (thousand) parts.push(`${under1000(thousand)} Thousand`);
  if (rest) parts.push(under1000(rest));

  const rupees = parts.length ? parts.join(' ') : 'Zero';
  const tail = paise ? ` and ${under100(paise)} Paise` : '';
  return `${negative ? 'Minus ' : ''}Rupees ${rupees}${tail} Only`;
}

/**
 * Indian bank reference numbers vary by rail, so this reports a shape rather
 * than passing judgement — a UTR that looks odd is worth a second look, not a
 * blocked entry.
 */
export function describeUtr(utr: string): { ok: boolean; rail: string | null; note: string | null } {
  const v = (utr || '').trim().toUpperCase();
  if (!v) return { ok: true, rail: null, note: null };
  if (/^[0-9]{12}$/.test(v)) return { ok: true, rail: 'UPI / IMPS', note: null };
  if (/^[A-Z]{4}[A-Z0-9]{12}$/.test(v)) return { ok: true, rail: 'NEFT', note: null };
  if (/^[A-Z]{4}[A-Z0-9]{14,18}$/.test(v)) return { ok: true, rail: 'RTGS', note: null };
  if (/^[A-Z0-9]{6,30}$/.test(v)) return { ok: true, rail: null, note: 'Unusual length for a UTR — worth double-checking against the bank statement.' };
  return { ok: false, rail: null, note: 'A UTR should be letters and digits only, with no spaces or symbols.' };
}

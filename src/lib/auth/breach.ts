import 'server-only';
import { createHash } from 'node:crypto';

/**
 * Has this password appeared in a known breach?
 *
 * Uses Have I Been Pwned's range API with k-anonymity: only the first five
 * characters of the hash leave this server, and the password itself never
 * does. Free, no account, no key.
 *
 * Fails open. If the service is unreachable we allow the password — refusing
 * to let someone set a password because a third party is down would be worse
 * than the risk it prevents.
 */
export async function timesBreached(password: string): Promise<number> {
  try {
    const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'AmeyaHeightsCRM' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return 0;

    const body = await res.text();
    for (const line of body.split('\n')) {
      const [suf, count] = line.trim().split(':');
      if (suf === suffix) return Number(count) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

/** Plain-English verdict for the person choosing the password. */
export async function breachVerdict(password: string): Promise<{ ok: boolean; message?: string }> {
  const n = await timesBreached(password);
  if (n === 0) return { ok: true };
  if (n < 10) {
    return { ok: false, message: 'That password has appeared in a data breach. Please choose a different one.' };
  }
  return {
    ok: false,
    message: `That password has appeared in ${n.toLocaleString('en-IN')} known breaches. Attackers try it early. Please choose a different one.`,
  };
}

import 'server-only';
import { lookup } from 'node:dns/promises';
import net from 'node:net';

/**
 * SSRF guard (fixes F-02/F-28). Resolves a URL's host and rejects any address in
 * a private / loopback / link-local / reserved range, and non-http(s) schemes.
 * Callers should fetch with redirect:'manual' and re-check each hop.
 */
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    const [a, b] = [p[0] ?? 0, p[1] ?? 0];
    if (a === 10) return true;
    if (a === 127) return true;                       // loopback
    if (a === 169 && b === 254) return true;          // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true;          // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true;// CGNAT 100.64/10
    if (a === 0) return true;
    return false;
  }
  const low = ip.toLowerCase();
  if (low === '::1' || low === '::') return true;
  if (low.startsWith('fe80') || low.startsWith('fc') || low.startsWith('fd')) return true; // link-local / ULA
  // IPv4-mapped IPv6 in ALL forms: dotted (::ffff:127.0.0.1) AND hex (::ffff:7f00:1).
  const mapped = low.match(/^::ffff:(.+)$/);
  if (mapped) {
    const rest = mapped[1] ?? '';
    if (rest.includes('.')) return isPrivateIp(rest);
    const hx = rest.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hx) {
      const a = parseInt(hx[1] ?? '0', 16), b = parseInt(hx[2] ?? '0', 16);
      return isPrivateIp(`${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`);
    }
    return true; // unrecognised mapped form → treat as unsafe
  }
  if (low.startsWith('64:ff9b:')) return true; // NAT64 (may embed a private v4)
  return false;
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Invalid URL'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http(s) URLs are allowed');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('That address is not reachable');
    return url;
  }
  const results = await lookup(host, { all: true });
  if (!results.length) throw new Error('Host did not resolve');
  for (const r of results) if (isPrivateIp(r.address)) throw new Error('That address is not reachable');
  return url;
}

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isMutating, crossOriginReason } from '../src/lib/security/same-origin';

/*
 * The security batch, from the August 2026 audit.
 *
 * Three of the nine findings did not survive checking, and those retractions
 * are recorded here as tests too — an assertion that a thing is ALREADY fine is
 * how a fixed problem stays fixed, and how a stale audit line stops being
 * re-raised every quarter.
 */

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(rel)) out.push(rel);
  }
  return out;
}

/** A fake NextRequest — only the bits crossOriginReason reads. */
const req = (headers: Record<string, string>, method = 'POST') =>
  ({ method, headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } }) as never;

describe('single sign-on runs the same gates as a password (AMH-043)', () => {
  const saml = read('src/app/api/auth/saml/callback/route.ts');
  const login = read('src/server/actions/auth.ts');

  it('the callback no longer creates a session straight from an assertion', () => {
    /*
     * It was `await createSession(user.id)` and nothing else. The password path
     * refuses a disallowed country, refuses an unapproved device, routes through
     * two-factor and alerts on a new device — none of which ran here. SSO was a
     * complete bypass of every login control the organisation had switched on.
     */
    for (const gate of ['getSecurityPolicy', 'countryAllowed', 'isKnownDevice', 'issueMfaTicket']) {
      expect(saml, `SSO does not call ${gate}`).toContain(gate);
    }
  });

  it('every gate the password path applies is applied here too', () => {
    // Named individually so adding one to login and forgetting SSO fails.
    for (const gate of ['getSecurityPolicy', 'countryAllowed', 'isKnownDevice', 'beginDeviceApproval', 'alertNewSignIn']) {
      expect(login, `login lost ${gate}`).toContain(gate);
      expect(saml, `SSO is missing ${gate}`).toContain(gate);
    }
  });

  it('a second factor yields a ticket, not a session', () => {
    // The order matters: issueMfaTicket must come BEFORE createSession, or the
    // user is already signed in by the time they are asked for a code.
    const ticket = saml.indexOf('issueMfaTicket');
    const session = saml.indexOf('await createSession');
    expect(ticket).toBeGreaterThan(-1);
    expect(ticket, 'a session is created before the second factor is checked').toBeLessThan(session);
  });

  it('does not bounce a user who has no second factor enrolled', () => {
    // An assertion cannot enrol a TOTP secret. Sending someone with no secret
    // to /two-factor locks them out of a working account.
    expect(saml).toMatch(/user\.twoFactorEnabled && user\.twoFactorSecret/);
  });
});

describe('a cookie-bearing write must come from our own pages (AMH-049)', () => {
  it('only mutating methods are checked', () => {
    expect(isMutating('POST')).toBe(true);
    expect(isMutating('delete')).toBe(true);
    expect(isMutating('GET')).toBe(false);
    expect(isMutating('HEAD')).toBe(false);
  });

  it('accepts our own pages', () => {
    expect(crossOriginReason(req({ 'sec-fetch-site': 'same-origin' }), 'https://crm.ameyaheights.com')).toBeNull();
    expect(crossOriginReason(
      req({ origin: 'https://crm.ameyaheights.com', host: 'crm.ameyaheights.com' }),
      'https://crm.ameyaheights.com',
    )).toBeNull();
  });

  it('refuses a sibling subdomain — the hole SameSite=Lax leaves open', () => {
    /*
     * This is the whole reason the guard exists. The session cookie is
     * `sameSite: 'lax'`, which already blocks classic cross-SITE form CSRF — so
     * the audit's "no origin check on 29 mutating routes" overstated it. But
     * Lax treats every subdomain as the same site, so a compromised or
     * third-party-hosted blog.ameyaheights.com CAN post to the CRM with the
     * user's cookie attached.
     */
    expect(crossOriginReason(req({ 'sec-fetch-site': 'same-site' }), 'https://crm.ameyaheights.com'))
      .toMatch(/same-site/);
    expect(crossOriginReason(
      req({ origin: 'https://blog.ameyaheights.com', host: 'crm.ameyaheights.com' }),
      'https://crm.ameyaheights.com',
    )).toMatch(/blog\.ameyaheights\.com/);
  });

  it('refuses an outright cross-site post', () => {
    expect(crossOriginReason(req({ 'sec-fetch-site': 'cross-site' }), 'https://crm.ameyaheights.com')).toMatch(/cross-site/);
    expect(crossOriginReason(
      req({ origin: 'https://evil.example', host: 'crm.ameyaheights.com' }),
      'https://crm.ameyaheights.com',
    )).toMatch(/evil\.example/);
  });

  it('allows a request no page initiated', () => {
    // sec-fetch-site: none is an address-bar navigation or a bookmark. Nothing
    // initiated it, so there is nothing to forge.
    expect(crossOriginReason(req({ 'sec-fetch-site': 'none' }), 'https://crm.ameyaheights.com')).toBeNull();
  });

  it('refuses a cookie-bearing post with no provenance at all', () => {
    // No browser sends a cookie-bearing POST with no Sec-Fetch-Site, no Origin
    // and no Referer. Whatever this is, it should not be using cookie auth.
    expect(crossOriginReason(req({}), 'https://crm.ameyaheights.com')).toMatch(/no origin/);
  });

  it('follows the host actually serving the request, not only APP_URL', () => {
    // Otherwise every preview deployment refuses its own writes.
    expect(crossOriginReason(
      req({ origin: 'https://preview-x.vercel.app', 'x-forwarded-host': 'preview-x.vercel.app', 'x-forwarded-proto': 'https' }),
      'https://crm.ameyaheights.com',
    )).toBeNull();
  });

  it('the guard is wired, and only for requests carrying a session cookie', () => {
    // src/, not the repo root — see tests/middleware-is-live.test.ts (AMH-054).
    // This test only ever proved the guard was WRITTEN; placement is what
    // decides whether it RUNS.
    const mw = read('src/middleware.ts');
    expect(mw).toMatch(/isMutating\(req\.method\) && req\.cookies\.has\(SESSION_COOKIE\)/);
    // Webhooks (Razorpay, WhatsApp), the SAML assertion and bearer-token API
    // callers carry no cookie of ours, so they are never checked. That is what
    // makes this safe to apply globally.
    expect(mw).toMatch(/matcher/);
    // The matcher must NOT exclude /api any more, or the guard never sees the
    // routes that actually mutate.
    expect(mw).not.toMatch(/\(\?!api\|/);
  });
});

describe('a connector cannot be pointed at the internal network (AMH-020)', () => {
  const registry = read('src/lib/connectors/registry.ts');

  it('the guard sits at the shared dispatch, not in each driver', () => {
    /*
     * The finding said the URL "is never validated". It is — by `test()`,
     * against a hostname pattern. The actual bug was that `send()` did not: an
     * admin could pass the test with a real hooks.slack.com URL, then edit the
     * stored config to http://169.254.169.254/ and every CRM event afterwards
     * would fetch the cloud metadata endpoint and hand back the response.
     *
     * Validate-on-write, trust-on-read. The fix is to validate at the moment of
     * the request, at the one place every driver funnels through.
     */
    expect(registry).toContain('assertPublicUrl');
    const guard = registry.indexOf('await assertPublicUrl(url)');
    const fetchCall = registry.indexOf('fetchWithTimeout(url');
    expect(guard).toBeGreaterThan(-1);
    expect(guard, 'the URL is fetched before it is checked').toBeLessThan(fetchCall);
  });

  it('blocks a REAL local target, resolving DNS rather than pattern-matching', async () => {
    /*
     * The version of this that passes without protecting anything is a regex
     * over the literal string. `localhost` is a hostname, not an address — a
     * guard that only rejects `127.0.0.1` lets it straight through, and so does
     * one that lets an attacker point a public DNS name at loopback.
     *
     * So: stand up a real server on loopback and confirm the guard refuses to
     * reach it by either name.
     */
    const { createServer } = await import('node:http');
    const { assertPublicUrl } = await import('../src/lib/security/ssrf');
    const srv = createServer((_q, r) => { r.end('SECRET'); }).listen(0);
    const port = (srv.address() as { port: number }).port;
    try {
      await expect(assertPublicUrl(`http://127.0.0.1:${port}/`)).rejects.toThrow();
      await expect(assertPublicUrl(`http://localhost:${port}/`)).rejects.toThrow();
    } finally {
      srv.close();
    }
  });

  it('still lets a genuinely public webhook through', async () => {
    // A guard that blocks everything is not a guard, it is an outage.
    const { assertPublicUrl } = await import('../src/lib/security/ssrf');
    await expect(assertPublicUrl('https://hooks.slack.com/services/T/B/X')).resolves.toBeInstanceOf(URL);
  });

  it('refuses private, loopback and link-local addresses', async () => {
    const { assertPublicUrl } = await import('../src/lib/security/ssrf');
    for (const url of [
      'http://169.254.169.254/latest/meta-data/',   // cloud metadata
      'http://127.0.0.1:5432/',
      'http://10.0.0.5/admin',
      'http://192.168.1.1/',
      'file:///etc/passwd',
      'gopher://x/',
    ]) {
      await expect(assertPublicUrl(url), `${url} was allowed`).rejects.toThrow();
    }
  });
});

describe('a lead name cannot run as script (AMH-003)', () => {
  const map = read('src/components/map/map-view.tsx');

  it('popups are built as DOM, not as a string of HTML', () => {
    /*
     * `Popup.setHTML()` assigns to innerHTML, and the lead name, project name,
     * address and locality went straight in. A lead named
     * `<img src=x onerror=…>` ran on our origin when an admin opened the map.
     *
     * `setDOMContent` parses nothing and `textContent` cannot create an
     * element, so this removes the class of bug rather than escaping around it.
     */
    expect(map).not.toContain('.setHTML(');
    expect(map).toContain('.setDOMContent(');
    expect(map).toMatch(/textContent = title/);
  });

  it('no other component builds HTML from a database string', () => {
    const offenders: string[] = [];
    for (const file of walk('src/components')) {
      const src = read(file);
      for (const m of src.matchAll(/\.setHTML\(|dangerouslySetInnerHTML/g)) {
        offenders.push(`${file}: ${m[0]}`);
      }
    }
    expect(offenders, `unescaped HTML sinks:\n${offenders.join('\n')}`).toEqual([]);
  });
});

describe('the security switches do what they say (AMH-004)', () => {
  it('the session length an admin sets is the session length they get', () => {
    /*
     * Admin → Security policy has "sessions last N hours" and it had ZERO
     * consumers: every session was cut to env.SESSION_TTL_HOURS regardless. An
     * administrator could set eight hours, see it saved, and get twelve.
     */
    const session = read('src/lib/auth/session.ts');
    expect(session).toContain('getSecurityPolicy');
    expect(session).toMatch(/policy\?\.sessionHours/);
    // The deployment's value stays a CEILING — a policy may shorten a session,
    // never lengthen it past what the deployment allows.
    expect(session).toMatch(/Math\.min\(/);
  });

  it('the step-up toggle is gone rather than decorative', () => {
    // It had no consumers anywhere. A switch that reports protection it does
    // not provide is worse than an absent one: an admin turns it on and stops
    // worrying. Removing it is the honest interim until real step-up auth.
    const view = read('src/components/admin/security-policy-view.tsx');
    expect(view).not.toMatch(/checked=\{p\.stepUp\}/);
    expect(read('src/lib/auth/policy.ts')).toMatch(/NOT IMPLEMENTED/);
  });

  it('ENFORCE_2FA was never the dead switch — it is wired, and stays wired', () => {
    // The audit called 2FA "a switch wired to nothing". Checked: ENFORCE_2FA
    // redirects in the app layout, and require2FA / deviceApproval / graceDays
    // all have real consumers. Pinned so the claim cannot become true later.
    expect(read('src/app/(app)/layout.tsx')).toMatch(/needsTwoFactor && env\.ENFORCE_2FA/);
  });
});

describe('self sign-up is opt-in (AMH-005)', () => {
  it('an absent setting means off, not on', () => {
    /*
     * It read `=== undefined ? true : …` — signup was ON until switched off, so
     * a fresh deployment (or a missing settings row) accepted new accounts.
     *
     * The exposure was narrower than the audit said: signup is restricted to
     * the configured mail domains and the address must be verified, so it was
     * never "anyone can sign up". But ameyaheights.com is the default domain,
     * so anyone with a mailbox there could self-provision an EMPLOYEE account.
     */
    const src = read('src/server/actions/signup.ts');
    expect(src).not.toMatch(/=== undefined \? true/);
    expect(src).toMatch(/const enabled = Boolean\(get\('auth\.signupEnabled'\)\)/);
  });

  it('the password floor is 12 characters, not the 8 the audit claimed', () => {
    // Recorded because the finding was wrong, and a wrong finding gets re-raised.
    expect(read('src/lib/auth/password.ts')).toMatch(/minLength: 12/);
  });
});

describe('PII that is worth stealing is encrypted at rest (AMH-022)', () => {
  const crypto = read('src/lib/security/pii-crypto.ts');

  it('covers the passport and the broker bank details', () => {
    // ChannelPartner.panNumber was protected and the free-text bank field in
    // the same row was not — and the bank details are the ones you can actually
    // send money with. A passport number is worth more than the PAN beside it.
    expect(crypto).toMatch(/ChannelPartner: new Set\(\['panNumber', 'bankDetails'\]\)/);
    // AMH-062 added overseasAddress beside the passport, and upiId beside the
    // vendor account number — same reasoning, one row later.
    expect(crypto).toMatch(/NriComplianceProfile: new Set\(\['passportNo', 'overseasAddress'\]\)/);
    expect(crypto).toMatch(/Vendor: new Set\(\['bankAccountNumber', 'pan', 'upiId'\]\)/);
  });

  it('the backfill writes the format the app reads', () => {
    /*
     * Verified against a real database: the script encrypted a broker's PAN and
     * bank details, and the app's own decrypt recovered both exactly.
     *
     * This assertion is the cheap standing guard on the expensive risk — the
     * script duplicates the crypto (it is plain node, the app is TS behind a
     * path alias), so if the app's format ever changes and the script does not,
     * it would write values nothing can read. Both sides are checked here.
     */
    const script = read('scripts/encrypt-existing-pii.mjs');
    const appCrypto = read('src/lib/utils/crypto.ts');
    // Same construction, same order, same encoding.
    expect(script).toContain("[iv, tag, enc].map((b) => b.toString('base64url')).join('.')");
    expect(appCrypto).toContain("[iv, tag, enc].map((b) => b.toString('base64url')).join('.')");
    // Same key derivation — the app ALWAYS hashes, so the script must too.
    expect(script).toMatch(/createHash\('sha256'\)\.update\(raw\)\.digest\(\)/);
    expect(appCrypto).toMatch(/createHash\('sha256'\)\.update\(env\.ENCRYPTION_KEY\)\.digest\(\)/);
    // Nothing is written without being asked.
    expect(script).toContain("process.argv.includes('--apply')");
  });
});

describe('findings that did not survive checking', () => {
  /*
   * Recorded as tests, not just as prose. A retraction with no assertion behind
   * it gets re-raised at the next audit, and somebody spends the day again.
   */

  it('AMH-042 — every route that imports a rate limiter calls it', () => {
    // The finding said rate limiting was "imported and not called on the public
    // endpoints". Eleven routes import a limiter; all eleven call it.
    const offenders: string[] = [];
    for (const file of walk('src/app/api')) {
      const src = read(file);
      const m = src.match(/import \{([^}]*)\} from '@\/lib\/security\/rate-limit'/);
      if (!m) continue;
      const limiters = m[1]!.split(',').map((n) => n.trim()).filter((n) => n === 'checkRate' || n === 'limitOr429');
      if (!limiters.length) continue;
      const body = src.slice(m.index! + m[0].length);
      if (!limiters.some((n) => new RegExp(`\\b${n}\\(`).test(body))) offenders.push(file);
    }
    expect(offenders, `imports a limiter and never calls it:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('AMH-021 — the admin backup exports no PAN or bank details', () => {
    // The finding said it "exports decrypted PAN, bank details". It selects
    // neither: users come back as id/name/username/email/phone/role/status,
    // customers as id/name/email/phone. Pinned so a widened select is noticed.
    const route = read('src/app/api/admin/backup/route.ts');
    for (const field of ['pan', 'bankAccountNumber', 'bankDetails', 'passportNo', 'panNumber']) {
      expect(route, `the backup now selects ${field}`).not.toMatch(new RegExp(`\\b${field}\\s*:\\s*true`));
    }
  });

  it('AMH-003 — every lead-write path requires a credential', () => {
    // The finding called the XSS reachable by an unauthenticated party. Every
    // ingest route needs a shared secret; the connector route needs a
    // per-connector key. It is privilege escalation, not anonymous injection.
    for (const route of ['src/app/api/ingest/lead/route.ts', 'src/app/api/ingest/portal/route.ts', 'src/app/api/ingest/social/route.ts']) {
      expect(read(route), `${route} is unauthenticated`).toContain('requireHeaderSecret');
    }
    expect(read('src/app/api/connectors/leads/[slug]/route.ts')).toMatch(/safeEqual\(secret, provided\)/);
  });
});

/**
 * AMH-062 — the backfill script and the runtime encryptor have to agree.
 *
 * The extension encrypts a field the next time the row is written; the script
 * is what closes the gap for rows nobody touches. A field added to one and not
 * the other is a field that stays in plaintext in production indefinitely,
 * while the code reads as though it is protected.
 */
describe('the PII backfill covers exactly what the runtime protects (AMH-062)', () => {
  it('every protected model.field appears in the script TARGETS', () => {
    const pii = read('src/lib/security/pii-crypto.ts');
    const script = read('scripts/encrypt-existing-pii.mjs');

    const body = pii.slice(pii.indexOf('const PROTECTED'), pii.indexOf('// Flat set'));
    const pairs: string[] = [];
    for (const m of body.matchAll(/(\w+): new Set\(\[([^\]]*)\]\)/g)) {
      const model = m[1]!;
      for (const f of m[2]!.matchAll(/'([^']+)'/g)) pairs.push(`${model}.${f[1]}`);
    }
    expect(pairs.length).toBeGreaterThan(4); // the regex actually found something

    const targets = new Set<string>();
    const t = script.slice(script.indexOf('const TARGETS'), script.indexOf('const prisma'));
    for (const m of t.matchAll(/\['(\w+)', '(\w+)'\]/g)) targets.add(`${m[1]}.${m[2]}`);

    expect(pairs.filter((p) => !targets.has(p))).toEqual([]);
    expect([...targets].filter((p) => !pairs.includes(p))).toEqual([]);
  });
});

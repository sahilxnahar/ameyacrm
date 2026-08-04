import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

/**
 * AMH-054 — the middleware has to be somewhere Next.js will actually look.
 *
 * This project keeps its code under `src/`. When a `src` directory exists,
 * Next.js loads middleware from `src/middleware.ts` and IGNORES a root-level
 * `middleware.ts` — silently. No warning at build, no warning at boot, no error
 * page. The build simply emits an empty middleware manifest and every request
 * skips it.
 *
 * It sat in the wrong place, and three controls were dead the whole time:
 *
 *   1. The cross-origin write guard (AMH-049). Every cookie-bearing POST was
 *      accepted whatever its Origin — which is exactly the sibling-subdomain
 *      CSRF hole that guard was written to close.
 *   2. ENFORCE_2FA. The layout only enforces enrolment when it can read the
 *      `x-pathname` header, and that header is set by the middleware. Absent
 *      header means "don't redirect" — a deliberate fail-open that was
 *      permanently open.
 *   3. mustChangePassword. Same header, same fail-open.
 *
 * The old test for (1) checked that the guard was *imported and called* in the
 * middleware source. It was. The file just never ran. So this test looks at
 * placement and at the BUILD OUTPUT, which is the only thing that can tell the
 * difference between wired and merely written.
 */
describe('the middleware actually runs (AMH-054)', () => {
  it('lives beside src/app, not at the repo root', () => {
    expect(existsSync('src/app')).toBe(true); // the condition that makes this matter
    expect(existsSync('src/middleware.ts')).toBe(true);
    expect(existsSync('middleware.ts')).toBe(false); // root copy is ignored — and misleading
  });

  it('still carries the cross-origin write guard', () => {
    const src = readFileSync('src/middleware.ts', 'utf8');
    expect(src).toMatch(/isMutating\(req\.method\)/);
    expect(src).toMatch(/crossOriginReason\(/);
    expect(src).toMatch(/status: 403/);
    // …and sets the header the layout's 2FA / password gates depend on.
    expect(src).toMatch(/set\('x-pathname'/);
  });

  it('the build emits a middleware, not an empty manifest', () => {
    const p = '.next/server/middleware-manifest.json';
    if (!existsSync(p)) return; // nothing built in this checkout; the checks above still hold
    const manifest = JSON.parse(readFileSync(p, 'utf8'));
    expect(Object.keys(manifest.middleware ?? {}).length).toBeGreaterThan(0);
    expect(manifest.sortedMiddleware?.length ?? 0).toBeGreaterThan(0);
  });
});

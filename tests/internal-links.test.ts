import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * AMH-081 — every internal link points at a route that exists.
 *
 * The home screen's "New leads today" tile linked to `/leads`. The route is
 * `/sales`. So the first tile a person sees after signing in led to a 404 — and
 * because Next prefetches links, merely rendering the home screen opened an RSC
 * request for the missing route that then sat there unanswered. That is how it
 * was found: a browser probe could not reach `networkidle` on `/home`, and the
 * one outstanding request was `/leads?_rsc=…`, still open after eleven seconds.
 *
 * A dead link is invisible in review — the string looks right, and nothing type
 * checks an href — so this compares every internal href in the source against
 * the real App Router tree.
 */

const APP = 'src/app';

function discoverRoutes(): Set<string> {
  const routes = new Set<string>();
  const walk = (dir: string, seg: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        // A (group) segment does not appear in the URL.
        walk(p, /^\(.*\)$/.test(e.name) ? seg : `${seg}/${e.name}`);
      } else if (/^page\.(tsx|ts|jsx|js)$/.test(e.name)) {
        routes.add(seg === '' ? '/' : seg);
      }
    }
  };
  walk(APP, '');
  return routes;
}

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p)) out.push(p);
    }
  };
  walk('src');
  return out;
}

describe('no internal link points at a route that does not exist (AMH-081)', () => {
  const routes = discoverRoutes();
  const dynamic = [...routes].filter((r) => r.includes('['));
  const staticRoutes = new Set([...routes].filter((r) => !r.includes('[')));

  const resolves = (href: string) => {
    if (staticRoutes.has(href)) return true;
    const parts = href.split('/');
    // A [param] segment matches anything; segment count must still agree.
    return dynamic.some((r) => {
      const rp = r.split('/');
      return rp.length === parts.length && rp.every((s, i) => s.startsWith('[') || s === parts[i]);
    });
  };

  it('found the route tree at all', () => {
    // Guards against the walker silently returning nothing, which would make
    // every assertion below vacuous.
    expect(routes.size).toBeGreaterThan(100);
    expect(staticRoutes.has('/home')).toBe(true);
    expect(staticRoutes.has('/sales')).toBe(true);
  });

  it('and correctly rejects a route that is not there', () => {
    // Non-vacuity: the exact bug this was written for.
    expect(resolves('/leads')).toBe(false);
    expect(resolves('/sales')).toBe(true);
  });

  it('every href, url, link and path literal in src/ resolves', () => {
    const dead: string[] = [];
    for (const f of sourceFiles()) {
      const src = readFileSync(f, 'utf8');
      for (const [i, line] of src.split('\n').entries()) {
        for (const m of line.matchAll(/(?:href|url|link|path)\s*[:=]\s*["'`](\/[a-zA-Z0-9\-_/]*)["'`]/g)) {
          const href = m[1]!.replace(/\/$/, '') || '/';
          if (href.startsWith('/api') || href.startsWith('/_next')) continue; // not pages
          if (/\.(png|jpg|jpeg|svg|ico|webmanifest|js|css|html|json|txt|xml)$/.test(href)) continue; // assets
          if (!resolves(href)) dead.push(`${f}:${i + 1} → ${href}`);
        }
      }
    }
    expect(dead).toEqual([]);
  });
});

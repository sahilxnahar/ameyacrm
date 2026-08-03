import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * A server file must not import a callable value from a `'use client'` module.
 *
 * This is the bug that took the whole CRM down for a day, and nothing caught it:
 * `next build` succeeded, every unit test passed, and the failure only appeared
 * when a signed-in page was actually rendered in a production build —
 *
 *   Attempted to call navModeFromCookie() from the server but navModeFromCookie
 *   is on the client.
 *
 * The directive applies to a whole FILE, so one browser-only helper living
 * beside a pure one turns the pure one into a client reference. It was in the
 * signed-in layout, a layout cannot catch its own error, so every screen became
 * "Something went wrong" — and because the symptom looks exactly like database
 * drift, we spent the day on the schema.
 *
 * Rendering a client COMPONENT from a server page is normal and correct, so
 * PascalCase imports are ignored; only lowercase values, which are things you
 * call, are flagged.
 */
const root = path.resolve(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

const files = walk(path.join(root, 'src'));
const isClient = new Map<string, boolean>();
for (const f of files) isClient.set(f, /^\s*(['"])use client\1/m.test(readFileSync(f, 'utf8').slice(0, 400)));

function resolveImport(from: string, spec: string): string | null {
  let base: string | null = null;
  if (spec.startsWith('@/')) base = path.join(root, 'src', spec.slice(2));
  else if (spec.startsWith('.')) base = path.join(path.dirname(from), spec);
  if (!base) return null;
  base = base.replace(/\\/g, '/');
  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    if (isClient.has(base + ext)) return base + ext;
  }
  return isClient.has(base) ? base : null;
}

describe('the server/client boundary', () => {
  it('never calls a client module from the server', () => {
    const offences: string[] = [];

    for (const f of files) {
      if (isClient.get(f)) continue;   // client → client is fine
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/import\s+(?!type\s)\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g)) {
        const target = resolveImport(f, m[2]!);
        if (!target || !isClient.get(target)) continue;
        const names = (m[1] ?? '')
          .split(',')
          .map((s) => s.trim().split(/\s+as\s+/).pop()!.trim())
          .filter(Boolean)
          .filter((n) => !n.startsWith('type '));
        // PascalCase = a React component, which a server file may legitimately render.
        const callable = names.filter((n) => !/^[A-Z]/.test(n));
        if (callable.length) {
          offences.push(`${path.relative(root, f)} imports ${callable.join(', ')} from the client module ${path.relative(root, target)}`);
        }
      }
    }

    expect(offences, `these will compile and then throw at runtime:\n${offences.join('\n')}`).toEqual([]);
  });

  it('keeps the nav-mode helper the layout uses on the server side', () => {
    const shared = readFileSync(path.join(root, 'src/lib/nav/nav-mode-shared.ts'), 'utf8');
    // The DIRECTIVE, not the words — the file explains itself in a comment.
    expect(shared).not.toMatch(/^\s*(['"])use client\1/m);
    expect(shared).toMatch(/export function navModeFromCookie/);

    const layout = readFileSync(path.join(root, 'src/app/(app)/layout.tsx'), 'utf8');
    expect(layout).toMatch(/from '@\/lib\/nav\/nav-mode-shared'/);
  });
});

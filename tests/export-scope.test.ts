import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');

/**
 * AMH-059 — an export must not see more than the screen does.
 *
 * `report.export` is a broad permission: a DEPARTMENT_HEAD holds it without
 * holding `lead.assign`, which is what `leadScope`/`bookingScope` key off. So
 * the on-screen lists correctly showed them their own team, and the Explorer's
 * CSV — same permission, no scope — returned ten thousand rows of every name,
 * phone, email and budget in the company. `leads.csv` and `bookings.csv` got
 * this right; `explorer.csv` and `collections.csv` did not.
 *
 * It is a GET, so neither the cross-origin write guard nor CSRF touches it.
 * Nothing but the scope clause stands between the permission and the data.
 */
describe('every personal-data export carries the hierarchy scope', () => {
  it('runExplorer cannot be called without an auth context', () => {
    const svc = read('src/server/services/explorer-service.ts');
    // Required and FIRST, so omitting it is a compile error rather than a habit.
    expect(svc).toMatch(/export async function runExplorer\(\s*\n?\s*ctx: AuthContext,/);
    expect(svc).toMatch(/leadScope\(ctx\)/);
    expect(svc).toMatch(/bookingScope\(ctx\)/);
  });

  it('the leads, bookings and collections branches each apply one', () => {
    const svc = read('src/server/services/explorer-service.ts');
    const bookings = svc.slice(svc.indexOf("if (entity === 'bookings')"), svc.indexOf("if (entity === 'units')"));
    const collections = svc.slice(svc.indexOf("if (entity === 'collections')"), svc.indexOf('// leads (default)'));
    const leads = svc.slice(svc.indexOf('// leads (default)'));
    expect(bookings).toMatch(/bookingScope\(ctx\)/);
    expect(collections).toMatch(/bookingScope\(ctx\)/);
    expect(leads).toMatch(/leadScope\(ctx\)/);
  });

  it('no CSV route that exports customer or lead data forgets it', () => {
    // The routes whose rows carry a person's name, phone, email or money.
    const personal = ['leads.csv', 'bookings.csv', 'collections.csv', 'explorer.csv'];
    const missing: string[] = [];
    for (const name of personal) {
      const src = read(`src/app/api/reports/${name}/route.ts`);
      const scoped = /leadScope\(|bookingScope\(/.test(src);
      // explorer.csv delegates to runExplorer, which the tests above pin.
      const delegates = /runExplorer\(ctx,/.test(src);
      if (!scoped && !delegates) missing.push(name);
    }
    expect(missing).toEqual([]);
  });

  it('and the list of routes to check is the real one', () => {
    // If someone adds a new .csv route, this fails and makes them decide
    // whether it needs a scope, rather than defaulting to "no".
    const known = new Set(['audit.csv', 'bookings.csv', 'cash-book.csv', 'collections.csv', 'explorer.csv', 'leads.csv', 'tasks.csv']);
    const actual = readdirSync('src/app/api/reports').filter((d) => d.endsWith('.csv'));
    expect(actual.filter((d) => !known.has(d))).toEqual([]);
  });
});

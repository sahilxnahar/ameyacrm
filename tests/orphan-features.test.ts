import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

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
const ALL = walk('src');

/*
 * Features that were built, work, and could not be reached (AMH-014, 045, 046).
 *
 * All three are the same shape: the hard part was finished and the last two
 * lines were not written. Nothing about any of them looks broken in the code —
 * they simply have no caller, which is invisible in review and total in use.
 */

describe('the full-page search can be reached (AMH-046)', () => {
  it('the command palette offers it once something has been typed', () => {
    /*
     * /app/(app)/search exists and searches more than the palette does. Nothing
     * linked to it, so it had only ever been seen by someone typing the URL.
     *
     * A nav item would have been wrong — the palette IS the search most of the
     * time. What it is not is complete: record results are capped at a handful.
     * The link belongs at the moment somebody typed a query and did not find
     * what they wanted.
     */
    const src = read('src/components/layout/command-palette.tsx');
    expect(src).toContain('/search?q=');
    expect(src).toContain('See all results for');
    // Only once there is a term — an empty query would land on an empty page.
    expect(src).toMatch(/\{term && \(/);
  });

  it('something in the product links to /search', () => {
    const linked = ALL.some((f) => /['"`]\/search\?q=|href="\/search/.test(read(f)));
    expect(linked, '/search is unreachable again').toBe(true);
  });
});

describe('“New lead” opens the form (AMH-045)', () => {
  it('the menu item carries the parameter that opens the dialog', () => {
    // It pointed at /sales and stopped there, with the dialog closed — so the
    // person picked "New lead" from a menu and then had to find the New lead
    // button on the page they had just been sent to.
    expect(read('src/components/layout/new-button.tsx')).toContain("href: '/sales?new=1'");
  });

  it('the pipeline opens on arrival rather than after a flash of the board', () => {
    const src = read('src/components/sales/sales-pipeline.tsx');
    // Initialised from the parameter, not set in an effect: an effect would
    // paint the board first and then pop the dialog over it.
    expect(src).toMatch(/React\.useState\(\(\) => searchParams\.get\('new'\) === '1'\)/);
  });
});

describe('bulk actions on leads are wired (AMH-014)', () => {
  it('bulkUpdateLeads has a caller', () => {
    /*
     * It existed complete in server/actions/bulk.ts — permission checked,
     * audited, notifying the new owner, and calling revalidatePath('/sales'),
     * which is to say it was written FOR the sales screen and never called
     * from it. Reassigning forty enquiries meant opening forty leads.
     */
    const callers = ALL.filter((f) => !f.endsWith('actions/bulk.ts') && read(f).includes('bulkUpdateLeads'));
    expect(callers, 'bulkUpdateLeads is still an orphan').not.toEqual([]);
  });

  it('the selection UI uses the shared primitives', () => {
    // BulkBar and RowCheck also existed, used on exactly one screen.
    const src = read('src/components/sales/sales-pipeline.tsx');
    expect(src).toContain('BulkBar');
    expect(src).toContain('RowCheck');
  });

  it('the tick box is outside the row link', () => {
    // A checkbox inside an <a> navigates instead of ticking — the row would
    // open the lead every time somebody tried to select it.
    const src = read('src/components/sales/sales-pipeline.tsx');
    const check = src.indexOf('label={`Select ${lead.name}`}');
    const link = src.indexOf('href={`/sales/${lead.id}`}', src.indexOf('function LeadRow'));
    expect(check).toBeGreaterThan(-1);
    expect(check, 'the tick box is inside the row link').toBeLessThan(link);
  });

  it('every bulk action the server offers is reachable', () => {
    const server = read('src/server/actions/bulk.ts');
    const ui = read('src/components/sales/sales-pipeline.tsx');
    // 'delete' is deliberately not offered here: it needs lead.delete and a
    // confirmation, and a silent bulk soft-delete behind a dropdown is how you
    // lose forty enquiries to a mis-click.
    for (const action of ['status', 'owner', 'temperature']) {
      expect(server, `server lost the ${action} action`).toContain(`d.action === '${action}'`);
      expect(ui, `${action} is not offered in the UI`).toContain(`action: '${action}'`);
    }
  });
});

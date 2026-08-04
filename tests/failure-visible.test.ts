import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Recoverability, from the August 2026 audit (AMH-007, AMH-028, AMH-034).
 *
 * One theme: a failure that produces no evidence of having failed. Each of
 * these was invisible in normal use and only shows up on the day it matters —
 * the day you need the backup, or the day the network drops mid-save.
 */

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (rel.endsWith('.tsx')) out.push(rel);
  }
  return out;
}

describe('a failed save cannot leave the button spinning (AMH-028)', () => {
  it('no `.then` that clears a pending flag is left without a `.catch`', () => {
    /*
     * The pattern, in 42 places across 30 screens:
     *
     *     setSaving(true);
     *     saveThing(form).then((r) => { setSaving(false); … });
     *
     * A server action that RESOLVES with `{ error }` was handled. One that
     * REJECTS — network drop, a deploy mid-request, a 500 — never reaches
     * `.then` at all, so `setSaving(false)` never runs. The button stays
     * disabled with a spinner on it, forever, and the only way out is a reload.
     *
     * Worse than the stuck button: the person has no idea whether the thing
     * saved. So the message says explicitly that nothing was saved.
     */
    const offenders: string[] = [];
    for (const file of walk('src')) {
      const src = read(file);
      for (const m of src.matchAll(/\.then\(/g)) {
        const i = m.index;
        let depth = 0;
        let j = i;
        while (j < src.length) {
          const c = src[j]!;
          if ('(['.includes(c) || c === '{') depth++;
          else if (')]'.includes(c) || c === '}') depth--;
          else if (c === ';' && depth <= 0) break;
          j++;
        }
        const chain = src.slice(i, j);
        if (chain.includes('.catch(') || chain.includes('.finally(')) continue;
        if (!/\bset\w*(?:Pending|Busy|Saving|Loading|Uploading|Submitting)\w*\(/.test(chain)) continue;
        offenders.push(`${file}:${src.slice(0, i).split('\n').length}`);
      }
    }
    expect(offenders, `chains that can strand a spinner:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('each handler clears the same flag the success path clears', () => {
    /*
     * The subtle way to get this wrong is a catch that shows a toast and
     * forgets the flag — which fixes the silence and leaves the button dead.
     * Every added handler resets the flag to the value the success path uses,
     * because it was generated from that call site rather than written by hand.
     */
    let checked = 0;
    for (const file of walk('src')) {
      const src = read(file);
      for (const m of src.matchAll(/\.catch\(\(\) => \{\n[\s\S]*?A rejected server action[\s\S]*?\n\s*\}\)/g)) {
        const block = m[0];
        expect(block, `${file}: handler sets no flag`).toMatch(/set\w+\(/);
        expect(block, `${file}: handler is silent`).toContain('toast.error');
        // It must not claim the save succeeded, and must not be vague about it.
        expect(block).toContain('Nothing was saved');
        checked++;
      }
    }
    expect(checked, 'no handlers found to check').toBeGreaterThanOrEqual(42);
  });
});

describe('the nightly backup cannot report a success it did not have (AMH-034)', () => {
  const route = read('src/app/api/cron/backup/route.ts');

  it('a storage failure is no longer swallowed', () => {
    /*
     * The route read:
     *
     *     try { … } catch { /* storage may be unconfigured *\/ }
     *     await writeAudit({ summary: `Automated backup ${stamp} (450 KB)` });
     *     return NextResponse.json({ ok: true, … });
     *
     * The upload has been failing on bad S3 credentials. The route caught the
     * error, wrote an audit line saying the backup had happened, and returned
     * HTTP 200 with ok:true. Three independent records of a success that did
     * not occur — which is strictly worse than no backup, because it removes
     * every reason to go and check.
     */
    expect(route).not.toMatch(/catch \{ \/\* storage may be unconfigured \*\/ \}/);
    expect(route).toMatch(/catch \(err\)/);
  });

  it('returns a failing status so a scheduler can see it', () => {
    // A cron runner decides whether to alert from the status code.
    expect(route).toMatch(/\{ status: 500 \}/);
    expect(route).toMatch(/ok: false/);
  });

  it('the audit trail records the failure as a failure', () => {
    expect(route).toMatch(/FAILED — nothing was stored/);
    /*
     * The success line moved: in v16.22 both backup callers were unified onto
     * backup-service.ts, because there were TWO implementations and the
     * unencrypted one was the only one actually scheduled. The route now only
     * owns the FAILURE path; the success audit belongs with the code that
     * actually stored something.
     */
    const service = read('src/server/services/backup-service.ts');
    expect(service).toMatch(/Automated backup \$\{stamp\} stored/);
    // And the route must not claim success on its own any more.
    expect(route).not.toMatch(/`Automated backup \$\{stamp\} \(/);
  });

  it('the state is visible in the app, not only in a cron log', () => {
    // Nobody reads cron logs until they already know something is wrong.
    const svc = read('src/server/services/integrations-service.ts');
    expect(svc).toMatch(/key: 'backup'/);
    expect(svc).toContain('backupFailed');
    // Never run at all, ran and failed, and ran too long ago are three
    // different problems with three different fixes.
    expect(svc).toContain('No backup has ever run');
    expect(svc).toContain('COULD NOT STORE IT');
    expect(svc).toContain('backupStale');
  });
});

describe('a write that loses business state is no longer swallowed (AMH-007)', () => {
  /*
   * 392 `.catch(() => …)` sites exist and most are correct: a count that reads
   * 0 for an un-migrated table, a `lastUsedAt` stamp, an audit line on a failed
   * login. Swallowing those is right — a failed audit write must not block a
   * logout.
   *
   * The dangerous ones are where the swallowed write is the one that decides
   * what the business does next. Two of those, both reachable with money:
   */

  it('a payment that posts but cannot mark the bill paid says so', () => {
    const src = read('src/server/actions/vendor-ledger.ts');
    /*
     * By the time this runs the voucher is POSTED — the money is in the books.
     * The bill status flip used to be `.catch(() => undefined)`, so on failure
     * the payment was made and the bill still read CERTIFIED. The next person
     * to look at the bill list sees an unpaid bill and pays it again: AMH-001's
     * double payment by another road, leaving no trace whatsoever.
     */
    expect(src).not.toMatch(/status: 'PAID' \} \}\)\.catch\(\(\) => undefined\)/);
    expect(src).toContain('settlementFailures');
    // Rollback is not available (the ledger entry exists), so the answer is to
    // report the split state loudly rather than reverse a posted voucher.
    expect(src).toMatch(/do NOT pay it again/);
    // …and the audit trail has to carry both halves, because a human has to
    // put them back together.
    expect(src).toMatch(/was POSTED but the bill could not be marked paid/);
  });

  it('an approval that cannot be applied is rolled back, not half-applied', () => {
    const src = read('src/server/actions/approvals.ts');
    /*
     * The approval was recorded, the requester was notified "your RA bill was
     * approved", and the bill stayed PENDING — because the single write that
     * changes what happens next was the one whose failure was discarded.
     * Three records disagreeing and nothing in the product to reconcile them.
     */
    expect(src).not.toMatch(/\}\)\.catch\(\(\) => \{\}\)/);
    // Unlike the payment above, nothing irreversible has happened yet, so the
    // decision can simply be put back and made again.
    expect(src).toMatch(/data: \{ status: 'PENDING' \} \}\)/);
    expect(src).toMatch(/has been rolled back/);
  });

  it('the legitimate best-effort catches are left alone', () => {
    // The point is not to remove every catch. A failed `lastUsedAt` stamp or a
    // failed audit line on a rejected login must never block the request.
    expect(read('src/lib/api/token-auth.ts')).toMatch(/lastUsedAt[\s\S]{0,80}catch/);
    expect(read('src/server/services/automation-log.ts')).toContain('Diagnostics must never be the reason');
  });
});

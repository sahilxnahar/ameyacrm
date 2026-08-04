import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Query cost, from the August 2026 audit (AMH-011, AMH-012, AMH-023, AMH-026).
 *
 * A page is slow far more often because it makes forty round-trips than because
 * any one of them is slow. The slow-query log cannot see that — forty queries of
 * 12ms each never trip an 800ms threshold, and are half a second of latency.
 *
 * So these tests count round-trips. The numbers are ceilings, deliberately: they
 * fail if the cost goes back up, which is the only way a fix like this stays
 * fixed once someone adds "just one more count" to a dashboard.
 */

const live = process.env.LIVE_DB;
const d = live ? describe : describe.skip;

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

d('the command centre pays for each count once', () => {
  let prismaMod: typeof import('../src/lib/db/prisma');
  let svc: typeof import('../src/server/services/command-center-service');

  beforeAll(async () => {
    process.env.DATABASE_URL = live;
    prismaMod = await import('../src/lib/db/prisma');
    svc = await import('../src/server/services/command-center-service');
  });

  it('loads both halves of the page in one sweep, not two', async () => {
    /*
     * Before: getCommandCenter and getLaunchpadBadges were independent, and the
     * page awaited both. Eleven counts were issued twice, plus the welfare
     * compliance sweep and the due-diligence expiry scan — measured at 35
     * round-trips for one dashboard load.
     *
     * Note what this test does NOT do: it does not call the two getters and hope
     * React `cache()` dedupes them. It measures the call the page makes. When
     * this was first written as `Promise.all([getCommandCenter(), getLaunchpad…])`
     * it measured 42 — cache() only dedupes inside a React render scope, so
     * merging the counts without also merging the entry point made it worse.
     */
    const { queries } = await prismaMod.countQueries(() => svc.getDashboard());
    expect(queries, `dashboard cost ${queries} round-trips`).toBeLessThanOrEqual(26);
  });

  it('both halves agree, because they read the same numbers', async () => {
    // Two counts taken a few milliseconds apart across a write disagree, and the
    // same screen then shows two different numbers for one thing. That reads as
    // a bug in the data, and sends whoever notices it looking in the wrong place.
    const { tiles, badges } = await svc.getDashboard();
    const value = (k: string) => tiles.find((t) => t.key === k)!.value;
    expect(badges.finance).toBe(value('msme') + value('gstr'));
    expect(badges.siteops).toBe(value('certs'));
    expect(badges.settings).toBe(value('deadletter'));
  });

  it('the two halves are still callable on their own', async () => {
    // Kept for any caller that genuinely wants one of them.
    const [cc, badges] = await Promise.all([svc.getCommandCenter(), svc.getLaunchpadBadges()]);
    expect(cc.tiles).toHaveLength(16);
    expect(Object.keys(badges)).toHaveLength(8);
  });

  it('the page calls the merged getter, not both halves', () => {
    const page = read('src/app/(app)/command-center/page.tsx');
    expect(page).toContain('getDashboard');
    expect(page).not.toContain('getLaunchpadBadges');
  });
});


/*
 * The indexes (AMH-023).
 *
 * These tests assert the PLAN, not the schema file. That distinction is the
 * whole finding: the first attempt at this fix added
 * `@@index([deletedAt, updatedAt])` to Lead and Task, and a test that checked
 * schema.prisma contained those lines would have passed. EXPLAIN showed the
 * planner ignored them and sequentially scanned anyway — `deletedAt IS NULL`
 * matches 95% of the rows, so the index is not selective and Postgres is right
 * to decline it. Three megabytes of write overhead per index, for nothing.
 *
 * An index that exists is not an index that is used. So: run the query the
 * screen runs, and fail if the plan says Seq Scan.
 */
d('the list screens are served by an index, not a scan', () => {
  let prisma: typeof import('../src/lib/db/prisma').prisma;

  beforeAll(async () => {
    process.env.DATABASE_URL = live;
    ({ prisma } = await import('../src/lib/db/prisma'));
  });

  const planFor = async (sql: string): Promise<string> => {
    // $queryRawUnsafe is banned in app code because user input must never reach
    // SQL unparameterised. EXPLAIN cannot take its statement as a bind
    // parameter, and every string below is a literal in this file, so this is
    // the one shape the rule cannot express an exception for.
    // eslint-disable-next-line no-restricted-properties
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(`EXPLAIN ${sql}`);
    return rows.map((r) => Object.values(r)[0]).join('\n');
  };

  const cases: Array<[string, string, string]> = [
    ['Sales board / api/v1/leads', 'Lead_live_updated_idx',
      `SELECT id FROM "Lead" WHERE "deletedAt" IS NULL ORDER BY "updatedAt" DESC LIMIT 50`],
    ['Explorer / AI index', 'Lead_live_created_idx',
      `SELECT id FROM "Lead" WHERE "deletedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 50`],
    ['Kanban board', 'Task_board_idx',
      `SELECT id FROM "Task" WHERE "deletedAt" IS NULL AND "parentId" IS NULL ORDER BY "position" ASC, "createdAt" DESC LIMIT 300`],
    ['Recent tasks', 'Task_live_created_idx',
      `SELECT id FROM "Task" WHERE "deletedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 25`],
    ['Notification bell', 'Notification_userId_createdAt_idx',
      `SELECT id FROM "Notification" WHERE "userId" = 'nobody' ORDER BY "createdAt" DESC LIMIT 20`],
  ];

  for (const [screen, index, sql] of cases) {
    it(`${screen} uses ${index}`, async () => {
      const plan = await planFor(sql);
      expect(plan, `plan was:\n${plan}`).toContain(index);
      expect(plan, `plan was:\n${plan}`).not.toContain('Seq Scan');
    });
  }

  it('the Lead project scope reaches an index too', async () => {
    /*
     * Not every soft-delete index has to be partial: projectId is selective on
     * its own, so the ordinary composite Prisma CAN express works here, and on
     * the 60,000-row database this was measured against the planner picks
     * Lead_projectId_deletedAt_idx (Index Scan, 2 buffers).
     *
     * Asserted as "an index, not a scan" rather than naming that index, because
     * WHICH one wins is a costing decision that legitimately changes with the
     * data — on an empty table (CI, before any seed) Postgres picks
     * Lead_live_updated_idx instead, and it is right to. Pinning the index name
     * would make this test fail on a correct plan.
     */
    const plan = await planFor(
      `SELECT id FROM "Lead" WHERE "deletedAt" IS NULL AND "projectId" = 'nobody' ORDER BY "updatedAt" DESC LIMIT 50`,
    );
    expect(plan, `plan was:\n${plan}`).toMatch(/Index (Only )?Scan/);
    expect(plan, `plan was:\n${plan}`).not.toContain('Seq Scan');
  });
});

describe('the index definitions are where they can actually be applied', () => {
  it('the partial ones are in constraints.sql, because schema.prisma cannot express them', () => {
    const sql = read('prisma/constraints.sql');
    for (const idx of ['Lead_live_updated_idx', 'Lead_live_created_idx', 'Task_live_created_idx', 'Task_board_idx']) {
      expect(sql, `${idx} missing from constraints.sql`).toContain(idx);
    }
    // A partial index without its predicate is a different index.
    expect(sql).toMatch(/WHERE "deletedAt" IS NULL/);
  });

  it('the Prisma-expressible ones are in the schema, so a fresh db push gets them', () => {
    const s = read('prisma/schema.prisma');
    const notification = s.slice(s.indexOf('\nmodel Notification {'));
    expect(notification.slice(0, notification.indexOf('\n}'))).toContain('@@index([userId, createdAt])');
    const lead = s.slice(s.indexOf('\nmodel Lead {'), s.indexOf('\nmodel LeadActivity {'));
    expect(lead).toContain('@@index([projectId, deletedAt])');
  });

  it('schema.prisma does NOT carry the composites that were measured useless', () => {
    // Guard against someone re-adding the obvious-looking fix.
    const s = read('prisma/schema.prisma');
    const lead = s.slice(s.indexOf('\nmodel Lead {'), s.indexOf('\nmodel LeadActivity {'));
    expect(lead).not.toContain('@@index([deletedAt, updatedAt])');
    expect(lead).not.toContain('@@index([deletedAt, createdAt])');
  });

  it('production gets them too — the migration carries every index by name', () => {
    // schema.prisma and constraints.sql only reach a database someone rebuilds.
    // Production was built by an earlier migration and is repaired by this file.
    const migration = read('MIGRATION_v16.19_all.sql');
    for (const idx of [
      'Lead_live_updated_idx', 'Lead_live_created_idx', 'Lead_projectId_deletedAt_idx',
      'Notification_userId_createdAt_idx', 'Task_live_created_idx', 'Task_board_idx',
    ]) {
      expect(migration, `${idx} missing from MIGRATION_v16.19_all.sql`).toContain(idx);
    }
    expect(migration).toContain('IF NOT EXISTS');
  });
});

/*
 * The N+1 loops (AMH-026).
 *
 * Four places issued one query per row. The point of these tests is not the
 * round-trip count on its own — it is that the batched version returns the SAME
 * ANSWER as the loop it replaced. A faster report that is subtly wrong is worse
 * than a slow one, and the cost-to-complete report is the screen that decides
 * whether a project is making money.
 */
d('the reports do not query per row', () => {
  let prismaMod: typeof import('../src/lib/db/prisma');
  let prisma: typeof import('../src/lib/db/prisma').prisma;
  let ctc: typeof import('../src/server/services/cost-to-complete-service');
  const tag = 'qcost';

  beforeAll(async () => {
    process.env.DATABASE_URL = live;
    prismaMod = await import('../src/lib/db/prisma');
    ({ prisma } = prismaMod);
    ctc = await import('../src/server/services/cost-to-complete-service');

    // Three projects with different shapes: one with an approved budget that is
    // superseded by a newer draft (the case the `status asc, version desc`
    // ordering exists for), one with a budget and no spend, one with nothing.
    await prisma.budgetLine.deleteMany({ where: { budget: { project: { code: { startsWith: tag } } } } });
    await prisma.budget.deleteMany({ where: { project: { code: { startsWith: tag } } } });
    await prisma.purchaseOrder.deleteMany({ where: { number: { startsWith: tag } } });
    await prisma.project.deleteMany({ where: { code: { startsWith: tag } } });
    await prisma.costCode.deleteMany({ where: { code: { startsWith: tag } } });

    const cc = await prisma.costCode.create({ data: { code: `${tag}-CC`, name: 'Test cost code' } });
    for (const [i, name] of ['A', 'B', 'C'].entries()) {
      const p = await prisma.project.create({
        data: { id: `${tag}-p${i}`, name: `${tag} ${name}`, code: `${tag}-${i}`, isActive: true },
      });
      if (i < 2) {
        const approved = await prisma.budget.create({
          data: { projectId: p.id, name: 'v1', version: 1, status: 'APPROVED' },
        });
        await prisma.budgetLine.create({ data: { budgetId: approved.id, costCodeId: cc.id, amount: 1_000_000 } });
        // A newer DRAFT that must NOT win: status ASC puts APPROVED first.
        const draft = await prisma.budget.create({
          data: { projectId: p.id, name: 'v2', version: 2, status: 'DRAFT' },
        });
        await prisma.budgetLine.create({ data: { budgetId: draft.id, costCodeId: cc.id, amount: 9_999_999 } });
      }
      if (i === 0) {
        await prisma.purchaseOrder.create({
          data: { number: `${tag}-PO-1`, projectId: p.id, status: 'ORDERED', total: 250_000 },
        });
        await prisma.purchaseOrder.create({
          // DRAFT must be excluded from "committed".
          data: { number: `${tag}-PO-2`, projectId: p.id, status: 'DRAFT', total: 777_777 },
        });
      }
    }
  });

  it('reads the approved budget, not the newest draft', async () => {
    const rows = (await ctc.getCostToComplete()).filter((r) => r.projectId.startsWith(tag));
    const a = rows.find((r) => r.projectId === `${tag}-p0`)!;
    expect(a.budget).toBe(1_000_000);   // not 9,999,999
    expect(a.committed).toBe(250_000);  // not 1,027,777 — DRAFT POs are not committed
    expect(a.toComplete).toBe(1_000_000 - a.spent);
  });

  it('does not sort a Prisma enum and hope it means what it reads like', async () => {
    /*
     * The bug this replaced: `orderBy: { status: 'asc' }` with a comment saying
     * it picked the approved budget. Postgres orders an enum by DECLARATION
     * order, and BudgetStatus is declared DRAFT, APPROVED, SUPERSEDED — so
     * 'asc' put DRAFT first and the money report read an unapproved draft.
     *
     * Pinned here so the fix is not "simplified" back into the database.
     */
    // eslint-disable-next-line no-restricted-properties -- literal, no input
    const rows = await prisma.$queryRawUnsafe<Array<{ status: string }>>(
      `SELECT unnest(enum_range(NULL::"BudgetStatus"))::text AS status`,
    );
    expect(rows.map((r) => r.status)).toEqual(['DRAFT', 'APPROVED', 'SUPERSEDED']);
    // The selection is made in code now, not by an ORDER BY the reader has to
    // know Postgres enum semantics to evaluate.
    const src = read('src/server/services/cost-to-complete-service.ts');
    expect(src).toMatch(/orderBy: \{ version: 'desc' \}/);
    expect(src).toContain("b.status === 'APPROVED'");
  });

  it('a project with no budget reads zero, not undefined', async () => {
    const rows = await ctc.getCostToComplete();
    const c = rows.find((r) => r.projectId === `${tag}-p2`)!;
    expect(c).toMatchObject({ budget: 0, committed: 0, spent: 0, toComplete: 0, pctUsed: 0 });
  });

  it('costs the same whether there are three projects or three hundred', async () => {
    // The loop made three round-trips per project. This makes five in total, and
    // five is what it makes at any portfolio size — that is the whole fix.
    const { queries } = await prismaMod.countQueries(() => ctc.getCostToComplete());
    expect(queries, `cost-to-complete made ${queries} round-trips`).toBeLessThanOrEqual(5);
  });
});

describe('the batched writes are single statements', () => {
  it('the retention sweep updates in one statement, not one per lead', () => {
    // take: 2000 above it, so the loop was up to two thousand sequential writes
    // inside the nightly cron — which has a timeout.
    const s = read('src/server/services/retention-service.ts');
    expect(s).toContain('prisma.lead.updateMany');
    expect(s).not.toMatch(/for \(const l of stale\)/);
  });

  it('DPDP erasure updates in one statement per table', () => {
    const s = read('src/server/actions/dpdp.ts');
    expect(s).toContain('prisma.lead.updateMany');
    expect(s).toContain('prisma.customer.updateMany');
    expect(s).not.toMatch(/for \(const c of customers\)/);
  });

  it('sequence enrolment inserts once and relies on the unique constraint', () => {
    const s = read('src/server/actions/sequences.ts');
    expect(s).toContain('createMany');
    expect(s).toContain('skipDuplicates: true');
    // The read-then-write loop it replaced was also a race: two admins enrolling
    // the same list both read "not enrolled" and both inserted.
    expect(s).not.toMatch(/for \(const l of leads\) \{\s*const exists/);
  });
});

describe('the organisation-wide settings are cached across requests', () => {
  it('the hot getters read through the cache, not straight to the table', () => {
    for (const f of ['src/server/services/company-service.ts', 'src/server/services/customisation-service.ts']) {
      const s = read(f);
      expect(s, `${f} still queries directly`).toContain('readSetting');
      expect(s, `${f} still queries directly`).not.toContain('prisma.setting.findUnique');
    }
  });

  it('every writer invalidates, including the reset path', () => {
    // A cache without invalidation is a bug that looks like "the save button
    // does not work". The reset path is the one that gets forgotten.
    const cust = read('src/server/actions/customisation.ts');
    expect((cust.match(/revalidateSetting\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(read('src/server/actions/company.ts')).toContain("revalidateSetting('company.details')");
  });

  it('the cache is keyed by setting name only, so it can never be per-user', () => {
    // The dangerous version of this fix caches something user-specific under a
    // global key and serves one person's data to another. The helper takes a
    // key and nothing else, which makes that mistake impossible to make.
    const s = read('src/lib/cache/settings-cache.ts');
    expect(s).toMatch(/export function readSetting<T>\(key: string\)/);
    expect(s).not.toMatch(/userId/);
  });
});

import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const live = process.env.LIVE_DB;

/*
 * AMH-033 — undo existed on 3 of ~120 destructive surfaces.
 *
 * The textbook fix is `deletedAt` on every model, and it was the wrong one: a
 * migration across dozens of tables AND a `deletedAt: null` filter on every
 * query that touches them. Miss one filter and deleted rows quietly reappear in
 * a list — a worse bug than the one being fixed, and invisible for months.
 *
 * So the delete stays a real delete and the row's own JSON is kept beside it.
 */
(live ? describe : describe.skip)('a deleted row can be put back', () => {
  let prisma: typeof import('../src/lib/db/prisma').prisma;
  let svc: typeof import('../src/server/services/undo-service');
  let userId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = live;
    ({ prisma } = await import('../src/lib/db/prisma'));
    svc = await import('../src/server/services/undo-service');
    const u = await prisma.user.upsert({
      where: { username: 'undo-test' },
      update: {},
      create: { name: 'Undo Test', username: 'undo-test', email: 'undo@x.test', passwordHash: 'x' },
    });
    userId = u.id;
  });

  const makeReminder = async (title: string) =>
    prisma.reminder.create({ data: { userId, title, dueAt: new Date('2026-09-01T00:00:00Z') } });

  it('comes back with the SAME id, so references still resolve', async () => {
    /*
     * Restoring under a new id would leave every audit line, link and document
     * that referenced the old one pointing at nothing — a restore that looks
     * successful and quietly breaks the things around it.
     */
    const row = await makeReminder('Chase the OC file');
    const token = await svc.recordDeletion('Reminder', row, { label: row.title, userId });
    await prisma.reminder.delete({ where: { id: row.id } });
    expect(await prisma.reminder.findUnique({ where: { id: row.id } })).toBeNull();

    const res = await svc.restoreDeleted(token!.id, userId);
    expect(res).toEqual({ ok: true, label: 'Chase the OC file' });

    const back = await prisma.reminder.findUnique({ where: { id: row.id } });
    expect(back?.id).toBe(row.id);
    expect(back?.title).toBe('Chase the OC file');
    // Dates have to survive the JSON round-trip or the restored row is subtly wrong.
    expect(back?.dueAt.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('can only be undone once', async () => {
    const row = await makeReminder('Only once');
    const token = await svc.recordDeletion('Reminder', row, { label: row.title, userId });
    await prisma.reminder.delete({ where: { id: row.id } });

    expect(await svc.restoreDeleted(token!.id, userId)).toMatchObject({ ok: true });
    // A second click on a toast that is still on screen must not throw a
    // unique-constraint error at somebody.
    const again = await svc.restoreDeleted(token!.id, userId);
    expect(again).toHaveProperty('error');
    expect((again as { error: string }).error).toMatch(/already/i);
  });

  it('refuses when the row is already back', async () => {
    const row = await makeReminder('Recreated by hand');
    const token = await svc.recordDeletion('Reminder', row, { label: row.title, userId });
    await prisma.reminder.delete({ where: { id: row.id } });
    // Somebody re-made it manually before pressing Undo.
    await prisma.reminder.create({ data: { id: row.id, userId, title: 'Recreated by hand', dueAt: row.dueAt } });

    const res = await svc.restoreDeleted(token!.id, userId);
    expect(res).toHaveProperty('error');
    expect((res as { error: string }).error).toMatch(/already exists/i);
  });

  it('refuses when the parent it belonged to is gone', async () => {
    /*
     * The honest limit of a one-row recycle bin. A foreign-key error surfaced
     * as "what it belonged to has been deleted too" is far better than a
     * half-restored object graph, or a raw Prisma error in a toast.
     *
     * Uses LitigationHearing because it has a REAL foreign key
     * (`matter LitigationMatter @relation(... onDelete: Cascade)`). The first
     * draft of this test used Reminder and passed for the wrong reason:
     * `Reminder.userId` is a bare String with no relation, so the database has
     * no constraint to violate and the restore simply succeeded. Ten models
     * are like that — deleting a user orphans their rows rather than cascading.
     * Pre-existing, out of scope here, and worth knowing.
     */
    const matter = await prisma.litigationMatter.create({
      data: { title: `Undo test ${Date.now()}` },
    });
    const row = await prisma.litigationHearing.create({
      data: { matterId: matter.id, date: new Date(), purpose: 'Orphan hearing' },
    });
    const token = await svc.recordDeletion('LitigationHearing', row, { label: 'Orphan hearing', userId });
    await prisma.litigationHearing.delete({ where: { id: row.id } });
    await prisma.litigationMatter.delete({ where: { id: matter.id } });

    const res = await svc.restoreDeleted(token!.id, userId);
    expect(res).toHaveProperty('error');
    expect((res as { error: string }).error).toMatch(/has been deleted too/i);
  });

  it('refuses a model name that is not a Prisma delegate', async () => {
    // `model` comes out of a database column and is used to index the Prisma
    // client. Unchecked, that is a way to call anything on it.
    const rec = await prisma.deletedRecord.create({
      data: { model: '$executeRawUnsafe', recordId: 'x', label: 'evil', payload: {}, deletedById: userId },
    });
    const res = await svc.restoreDeleted(rec.id, userId);
    expect(res).toHaveProperty('error');
    expect((res as { error: string }).error).toMatch(/can no longer be restored/i);
  });

  it('expires, so the bin is a window and not a second database', async () => {
    const row = await makeReminder('Too old');
    const token = await svc.recordDeletion('Reminder', row, { label: row.title, userId });
    await prisma.reminder.delete({ where: { id: row.id } });
    await prisma.deletedRecord.update({
      where: { id: token!.id },
      data: { deletedAt: new Date(Date.now() - (svc.UNDO_WINDOW_HOURS + 1) * 3600e3) },
    });
    const res = await svc.restoreDeleted(token!.id, userId);
    expect((res as { error: string }).error).toMatch(/no longer be undone/i);
  });

  it('the nightly pass clears out expired entries', async () => {
    const n = await svc.pruneDeletedRecords(new Date());
    expect(n).toBeGreaterThanOrEqual(1);
    expect(read('src/server/services/nightly-pass.ts')).toContain('pruneDeletedRecords');
  });

  it('recording a deletion never blocks the delete', async () => {
    /*
     * A recycle-bin failure must not stop the thing the user actually asked
     * for. It returns null and the caller simply offers no undo.
     *
     * Forced with a circular object, which JSON.stringify throws on — a real
     * way this can fail, and the one the try/catch is there for.
     */
    const circular: Record<string, unknown> & { id: string } = { id: 'x' };
    circular.self = circular;
    const bad = await svc.recordDeletion('Reminder', circular, { label: 'x', userId });
    expect(bad).toBeNull();
  });
});

describe('the offer is where the user is looking', () => {
  it('undo rides on the confirmation toast', () => {
    // A recycle bin somebody has to go and find is used by nobody: the moment
    // you want undo is the second after you pressed delete.
    const src = read('src/lib/forms/undo-toast.tsx');
    expect(src).toContain("label: 'Undo'");
    expect(src).toMatch(/duration: 10_000/);
    // Null token = the deletion could not be recorded. The delete still
    // happened, so show the toast WITHOUT offering an undo that would fail.
    expect(src).toMatch(/if \(!undo\)/);
  });

  it('the delete actions hand back a token', () => {
    for (const f of ['reminders', 'floor-plans', 'custom-fields', 'marketing-library', 'home-loans', 'legal-docket', 'due-diligence']) {
      const src = read(`src/server/actions/${f}.ts`);
      expect(src, `${f} does not record deletions`).toContain('recordDeletion(');
      // Read BEFORE the delete — afterwards there is nothing left to serialise.
      const read_ = src.indexOf('findUnique({ where: { id } })');
      const del = src.indexOf('.delete({ where: { id } })');
      expect(read_, `${f} reads the row after deleting it`).toBeLessThan(del);
    }
  });
});

import 'server-only';
import { prisma, isPooledConnection } from '@/lib/db/prisma';

export interface Probe { name: string; what: string; ms: number; verdict: 'good' | 'slow' | 'bad'; detail: string }
export interface TableSize { model: string; rows: number }

const time = async <T>(fn: () => Promise<T>): Promise<[T, number]> => {
  const t0 = Date.now();
  const out = await fn();
  return [out, Date.now() - t0];
};

/**
 * Measure the things that actually make a page feel slow, rather than
 * reporting settings. Every number here comes from a query run just now.
 */
export async function measurePerformance(): Promise<{
  pooled: boolean;
  region: string | null;
  probes: Probe[];
  tables: TableSize[];
  advice: string[];
}> {
  const probes: Probe[] = [];

  // 1. Bare round trip — this is the floor for every page on the site.
  const [, pingMs] = await time(() => prisma.$queryRaw`SELECT 1`);
  probes.push({
    name: 'Database round trip',
    what: 'How long one trivial query takes, end to end',
    ms: pingMs,
    verdict: pingMs < 60 ? 'good' : pingMs < 250 ? 'slow' : 'bad',
    detail:
      pingMs < 60
        ? 'Healthy. The database is close and the connection is warm.'
        : pingMs < 250
          ? 'Sluggish. Usually a cold Neon instance waking up, or the database being in a different region from the deployment.'
          : 'Very slow. Check that DATABASE_URL uses the -pooler host and that Neon is in the same region as Vercel.',
  });

  // 2. Second round trip — if this is much faster, the first paid a cold start.
  const [, warmMs] = await time(() => prisma.$queryRaw`SELECT 1`);
  probes.push({
    name: 'Second round trip',
    what: 'The same query again, on a now-warm connection',
    ms: warmMs,
    verdict: warmMs < 40 ? 'good' : warmMs < 150 ? 'slow' : 'bad',
    detail:
      pingMs - warmMs > 200
        ? `The first query paid ${pingMs - warmMs} ms of wake-up cost. That is Neon resuming from idle — the first person to open the CRM each morning will feel it, nobody else will.`
        : 'Consistent with the first, so there is no cold-start penalty right now.',
  });

  // 3. A realistic dashboard-style read.
  const [, listMs] = await time(() =>
    prisma.task.findMany({ where: { deletedAt: null }, take: 25, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, status: true } }),
  );
  probes.push({
    name: 'Typical list query',
    what: 'Twenty-five tasks, newest first — what a page actually does',
    ms: listMs,
    verdict: listMs < 120 ? 'good' : listMs < 400 ? 'slow' : 'bad',
    detail: listMs < 120 ? 'Fast enough that the page will feel instant.' : 'A list this small should be quick. If it is not, the round trip above is the cause, not the query.',
  });

  // 4. A count across a big table, which is what dashboards quietly do a lot of.
  const [, countMs] = await time(() => prisma.auditLog.count());
  probes.push({
    name: 'Counting a large table',
    what: 'Postgres counts every row — dashboards do this often',
    ms: countMs,
    verdict: countMs < 150 ? 'good' : countMs < 600 ? 'slow' : 'bad',
    detail: countMs < 150 ? 'Fine at this data volume.' : 'Counts get slower as the audit log grows. Worth trimming old entries once this passes a few hundred thousand rows.',
  });

  const models: Array<[string, () => Promise<number>]> = [
    ['Audit log', () => prisma.auditLog.count()],
    ['Documents', () => prisma.document.count()],
    ['Search passages', () => prisma.docChunk.count()],
    ['Tasks', () => prisma.task.count()],
    ['Leads', () => prisma.lead.count()],
    ['Payments', () => prisma.voucher.count()],
    ['Notifications', () => prisma.notification.count()],
  ];
  const tables: TableSize[] = [];
  for (const [model, fn] of models) {
    tables.push({ model, rows: await fn().catch(() => -1) });
  }

  let region: string | null = null;
  try {
    region = new URL(process.env.DATABASE_URL ?? '').hostname.split('.').slice(1, 3).join('.') || null;
  } catch {
    region = null;
  }

  const advice: string[] = [];
  const pooled = isPooledConnection();
  if (!pooled) {
    advice.push(
      'DATABASE_URL is not using Neon\'s pooled endpoint. In Neon, copy the connection string with "-pooler" in the host and set it as DATABASE_URL, keeping the direct one as DATABASE_URL_UNPOOLED. This is usually the single biggest speed-up on Vercel.',
    );
  }
  if (pingMs > 250) {
    advice.push('The round trip is slow enough that the database may be in a different region from the deployment. Neon and Vercel should both be in the region nearest Bangalore.');
  }
  const audit = tables.find((t) => t.model === 'Audit log');
  if (audit && audit.rows > 200000) {
    advice.push(`The audit log holds ${audit.rows.toLocaleString('en-IN')} rows. Archiving entries older than a year will speed up anything that counts or filters it.`);
  }
  const chunks = tables.find((t) => t.model === 'Search passages');
  if (chunks && chunks.rows > 20000) {
    advice.push(`There are ${chunks.rows.toLocaleString('en-IN')} search passages. Document Q&A loads embeddings into memory, so this is worth watching.`);
  }
  if (!advice.length) advice.push('Nothing is obviously wrong. If a particular page still feels slow, tell me which one and I will measure that page specifically.');

  return { pooled, region, probes, tables, advice };
}

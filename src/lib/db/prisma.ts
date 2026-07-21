import { PrismaClient } from '@prisma/client';

/**
 * Work out the best connection string for a serverless request.
 *
 * On Vercel every request may be a fresh instance, so opening a direct
 * Postgres connection each time costs a full TCP + TLS handshake before any
 * query runs — which is most of the "why is this page slow" feeling. Neon's
 * pooled endpoint (the one with `-pooler` in the host) keeps warm connections
 * on their side, and `connection_limit=1` stops each instance hoarding more
 * than it needs.
 */
function connectionUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const pooled = url.hostname.includes('-pooler');
    if (pooled) {
      // pgbouncer in transaction mode cannot use prepared statements.
      if (!url.searchParams.has('pgbouncer')) url.searchParams.set('pgbouncer', 'true');
      if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '1');
    }
    if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '10');
    return url.toString();
  } catch {
    return raw;
  }
}

/** True when the app is talking to Neon's pooled endpoint. Shown in Admin → Performance. */
export function isPooledConnection(): boolean {
  try {
    return new URL(process.env.DATABASE_URL ?? '').hostname.includes('-pooler');
  } catch {
    return false;
  }
}

/**
 * Slow-query logging. Any query slower than this threshold is logged with the
 * model and operation, so the genuinely slow ones surface instead of being
 * guessed at. Cheap — it only wraps timing around the call it was already making.
 */
const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS ?? 800);

function makePrisma() {
  const base = new PrismaClient({
    datasourceUrl: connectionUrl(),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
  return base.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        const start = performance.now();
        try {
          return await query(args);
        } finally {
          const ms = performance.now() - start;
          if (ms > SLOW_QUERY_MS) {
            // eslint-disable-next-line no-console
            console.warn(`[slow-query] ${model ?? 'raw'}.${operation} took ${Math.round(ms)}ms`);
          }
        }
      },
    },
  });
}

type ExtendedPrisma = ReturnType<typeof makePrisma>;
const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrisma };

export const prisma: ExtendedPrisma = globalForPrisma.prisma ?? makePrisma();

// Reused across invocations on the same warm instance, and across hot reloads
// in development. Without this each reload leaks a connection.
globalForPrisma.prisma = prisma;

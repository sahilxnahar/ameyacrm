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

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: connectionUrl(),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

// Reused across invocations on the same warm instance, and across hot reloads
// in development. Without this each reload leaks a connection.
globalForPrisma.prisma = prisma;

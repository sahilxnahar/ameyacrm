import 'server-only';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db/prisma';

export interface RateResult { allowed: boolean; remaining: number; retryAfterSec: number }

/** The caller's address, as best we can tell behind Vercel's proxy. */
export async function callerIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0]?.trim() : null) || h.get('x-real-ip') || 'unknown';
}

/**
 * Fixed-window counter kept in the database.
 *
 * Fails open. If the counter itself cannot be read or written, the request is
 * allowed — a database hiccup should not take sign-in down. Rate limiting is
 * there to blunt abuse, not to be a second point of failure.
 */
export async function checkRate(bucket: string, limit: number, windowSec: number): Promise<RateResult> {
  try {
    const now = Date.now();
    const windowStart = new Date(Math.floor(now / (windowSec * 1000)) * windowSec * 1000);

    const row = await prisma.rateLimit.upsert({
      where: { bucket_windowStart: { bucket, windowStart } },
      update: { count: { increment: 1 } },
      create: { bucket, windowStart, count: 1 },
      select: { count: true },
    });

    const remaining = Math.max(0, limit - row.count);
    const retryAfterSec = Math.max(1, Math.ceil((windowStart.getTime() + windowSec * 1000 - now) / 1000));
    return { allowed: row.count <= limit, remaining, retryAfterSec };
  } catch {
    return { allowed: true, remaining: limit, retryAfterSec: 0 };
  }
}

/** Convenience for API routes: returns a 429 Response when over the limit. */
export async function limitOr429(bucket: string, limit: number, windowSec: number): Promise<Response | null> {
  const r = await checkRate(bucket, limit, windowSec);
  if (r.allowed) return null;
  return new Response(JSON.stringify({ error: 'Too many requests. Slow down.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(r.retryAfterSec) },
  });
}

/** Housekeeping — old windows are dead weight. Called from the hourly job. */
export async function pruneRateLimits(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
    const r = await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: cutoff } } });
    return r.count;
  } catch { return 0; }
}

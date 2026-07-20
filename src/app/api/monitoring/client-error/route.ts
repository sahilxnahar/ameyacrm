import { NextResponse, type NextRequest } from 'next/server';
import { logError } from '@/lib/monitoring/log-error';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

/** Receives crashes from the browser error boundary. */
export async function POST(req: NextRequest) {
  const over = await limitOr429(`client-error:${await callerIp()}`, 30, 60);
  if (over) return over;

  try {
    const b = (await req.json()) as { message?: string; stack?: string; path?: string };
    const user = await getCurrentUser().catch(() => null);
    const err = new Error(String(b.message ?? 'Unknown client error').slice(0, 400));
    err.stack = String(b.stack ?? '').slice(0, 4000);
    await logError(err, { path: b.path, userId: user?.id });
  } catch { /* swallow */ }
  return NextResponse.json({ ok: true });
}

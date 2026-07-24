export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Receives a Core Web Vitals sample from the client and logs it as a structured
 * line. Vercel captures stdout, so the samples are queryable in the platform
 * logs and can be picked up by the monitoring layer — no database table, because
 * this is telemetry, not business data. Always answers 204 and never throws; a
 * telemetry endpoint that errors would turn a slow page into a broken one.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const d = (await req.json()) as { name?: string; value?: number; rating?: string | null; path?: string };
    if (d && typeof d.name === 'string') {
      console.log('[web-vitals]', JSON.stringify({ name: d.name, value: d.value, rating: d.rating ?? null, path: d.path ?? '' }));
    }
  } catch {
    /* ignore malformed payloads */
  }
  return new Response(null, { status: 204 });
}

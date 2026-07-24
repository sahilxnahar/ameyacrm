import 'server-only';

/**
 * Real-time transport (H2) — the software side.
 *
 * The app is serverless, so it can't hold a WebSocket open itself. Instead it
 * *publishes* an event to a configured realtime relay (any SSE / pub-sub service
 * — self-hosted or hosted), and browsers subscribe to that relay over
 * Server-Sent Events (see `use-realtime.ts`). The database stays the source of
 * truth; this is only a nudge that says "something changed, refresh now".
 *
 * Nothing here is required: with no relay configured, `publish` is a no-op and
 * the existing calm polling remains the source of truth. Switch it on by setting
 * REALTIME_PUBLISH_URL (and NEXT_PUBLIC_REALTIME_SSE_URL for the browser).
 */
export function realtimeConfigured(): boolean {
  return Boolean(process.env.REALTIME_PUBLISH_URL && process.env.REALTIME_PUBLISH_URL.trim());
}

export async function publish(channel: string, event: string, data: Record<string, unknown> = {}): Promise<void> {
  const url = process.env.REALTIME_PUBLISH_URL?.trim();
  if (!url) return; // not configured — polling is the safety net
  try {
    const token = process.env.REALTIME_PUBLISH_TOKEN?.trim();
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ channel, event, data }),
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    });
  } catch {
    // A realtime hiccup must never affect the action that triggered it.
  }
}

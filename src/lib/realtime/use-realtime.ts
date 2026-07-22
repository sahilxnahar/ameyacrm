'use client';
import * as React from 'react';

/** True when a realtime SSE endpoint is configured for the browser to subscribe to. */
export function realtimeEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_REALTIME_SSE_URL);
}

/**
 * Subscribe to a realtime channel over Server-Sent Events — if a realtime service
 * is configured. `onEvent` fires whenever the server pushes to the channel, so
 * the caller can refresh instantly instead of waiting for the next poll.
 *
 * When nothing is configured (the default), this is completely inert: no
 * connection is opened and the caller's polling remains the source of truth.
 */
export function useRealtimeChannel(channel: string | null, onEvent: () => void): void {
  const cb = React.useRef(onEvent);
  cb.current = onEvent;

  React.useEffect(() => {
    const base = process.env.NEXT_PUBLIC_REALTIME_SSE_URL;
    if (!base || !channel || typeof EventSource === 'undefined') return;
    let es: EventSource | null = null;
    try {
      const sep = base.includes('?') ? '&' : '?';
      es = new EventSource(`${base}${sep}channel=${encodeURIComponent(channel)}`);
      es.onmessage = () => cb.current();
    } catch {
      return;
    }
    return () => { es?.close(); };
  }, [channel]);
}

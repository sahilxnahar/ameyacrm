'use client';
import { useReportWebVitals } from 'next/web-vitals';

/**
 * Batch 13 (observability): capture real-user Core Web Vitals — LCP, INP, CLS,
 * FCP, TTFB — from actual navigation and post them to `/api/vitals`, which logs
 * them. This turns "the dashboard feels slow" into a number, per route, measured
 * on the devices people really use rather than a synthetic test.
 *
 * Fire-and-forget and wrapped in try/catch: telemetry must never block a paint
 * or break the page it is measuring. Uses `sendBeacon` when available so the
 * report survives a navigation away.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    try {
      const body = JSON.stringify({
        name: metric.name,
        value: Math.round(metric.value * 100) / 100,
        rating: (metric as { rating?: string }).rating ?? null,
        id: metric.id,
        path: typeof location !== 'undefined' ? location.pathname : '',
      });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/vitals', body);
      } else {
        void fetch('/api/vitals', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } });
      }
    } catch {
      /* telemetry must never break the page */
    }
  });
  return null;
}

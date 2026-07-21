/**
 * "Help, don't break" (I2). When one system leans on another, a failure in the
 * helper should degrade gracefully — not take down the caller. These wrap a
 * cross-system call so a thrown error becomes a logged warning and a sensible
 * fallback value.
 */

/** Run an async helper; on failure, log and return the fallback. */
export async function safely<T>(fn: () => Promise<T>, fallback: T, label = 'operation'): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[resilience] ${label} failed, using fallback:`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

/** Fire-and-forget a helper that must never affect the caller (e.g. emitting an event, notifying). */
export function fireAndForget(fn: () => Promise<unknown>, label = 'side-effect'): void {
  Promise.resolve()
    .then(fn)
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[resilience] ${label} failed (ignored):`, err instanceof Error ? err.message : err);
    });
}

/** Race a promise against a timeout so one slow dependency can't hang a request. */
export async function withTimeout<T>(fn: () => Promise<T>, ms: number, fallback: T, label = 'operation'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn(`[resilience] ${label} timed out after ${ms}ms, using fallback`);
      resolve(fallback);
    }, ms);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[resilience] ${label} failed, using fallback:`, err instanceof Error ? err.message : err);
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

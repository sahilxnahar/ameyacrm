/**
 * The internal event backbone (I1). One place where "something happened" is
 * announced, and any subsystem that cares subscribes — instead of every feature
 * wiring its own reactions by hand.
 *
 * Two rules make this safe to build on:
 *   1. A handler that throws is caught and logged — it can never break the
 *      action that emitted the event, and it never stops the *other* handlers.
 *   2. `emit` never throws. Producers can fire-and-forget.
 *
 * Kept dependency-free (no prisma import) so it stays pure and testable;
 * subscribers that touch the database live in `subscribers.ts` and register
 * themselves via import side-effect.
 */

export type AppEvent =
  | { type: 'workrequest.raised'; requestId: string; reference: string; title: string; toDeptId: string | null; actorId?: string | null }
  | { type: 'workrequest.advanced'; requestId: string; reference: string; title: string; toStatus: string; raiserId?: string | null; actorId?: string | null };

export type AppEventType = AppEvent['type'];
export type Handler<T extends AppEventType = AppEventType> = (event: Extract<AppEvent, { type: T }>) => void | Promise<void>;

type AnyHandler = (event: AppEvent) => void | Promise<void>;
const handlers = new Map<string, AnyHandler[]>();

/** Subscribe to an event type. Returns an unsubscribe function. */
export function on<T extends AppEventType>(type: T, handler: Handler<T>): () => void {
  const fn = handler as unknown as AnyHandler;
  const list = handlers.get(type) ?? [];
  list.push(fn);
  handlers.set(type, list);
  return () => {
    const cur = handlers.get(type);
    if (!cur) return;
    handlers.set(type, cur.filter((h) => h !== fn));
  };
}

/**
 * Announce that something happened. Every subscriber runs; a failure in one is
 * logged and skipped so it cannot affect the others or the caller. Awaitable,
 * but callers may safely ignore the promise.
 */
export async function emit(event: AppEvent): Promise<void> {
  const list = handlers.get(event.type);
  if (!list || list.length === 0) return;
  for (const handler of list) {
    try {
      await handler(event);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[event] handler for "${event.type}" failed:`, err instanceof Error ? err.message : err);
    }
  }
}

/** Testing helper: drop all handlers. */
export function _resetHandlers(): void {
  handlers.clear();
}

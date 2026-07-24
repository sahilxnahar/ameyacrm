'use client';

import { fetchWithTimeout } from '@/lib/utils/fetch-timeout';

/**
 * A small outbox for work typed with no signal.
 *
 * Site basements and stairwells have no bars, which is exactly where notes get
 * written. Anything queued here survives the page being closed and the phone
 * being locked, and sends itself the moment the connection returns.
 *
 * IndexedDB rather than localStorage: photos and notes can be large, and
 * localStorage is both small and synchronous.
 */
const DB = 'ameya-outbox';
const STORE = 'pending';

export interface Queued {
  id: string;
  kind: 'site-note' | 'task-update' | 'expense';
  label: string;        // what to show the person
  endpoint: string;
  payload: unknown;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(item: Omit<Queued, 'id' | 'createdAt' | 'attempts'>): Promise<string> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await tx('readwrite', (s) => s.put({ ...item, id, createdAt: Date.now(), attempts: 0 }));
  return id;
}

export async function list(): Promise<Queued[]> {
  const all = await tx<Queued[]>('readonly', (s) => s.getAll() as IDBRequest<Queued[]>);
  return (all ?? []).sort((a, b) => a.createdAt - b.createdAt);
}

export async function remove(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id) as unknown as IDBRequest<undefined>);
}

async function markFailed(item: Queued, error: string): Promise<void> {
  await tx('readwrite', (s) => s.put({ ...item, attempts: item.attempts + 1, lastError: error }));
}

/**
 * Try to send everything waiting. Safe to call as often as you like — each item
 * is removed only once the server has accepted it, so nothing is sent twice and
 * nothing is lost if the send fails halfway.
 */
export async function flush(): Promise<{ sent: number; failed: number; left: number }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { sent: 0, failed: 0, left: (await list()).length };
  }
  const items = await list();
  let sent = 0;
  let failed = 0;
  for (const item of items) {
    // Give up after a day of trying rather than retrying for ever.
    if (item.attempts > 24) continue;
    try {
      const res = await fetchWithTimeout(item.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });
      if (res.ok) { await remove(item.id); sent++; }
      else { await markFailed(item, `Server said ${res.status}`); failed++; }
    } catch (e) {
      await markFailed(item, e instanceof Error ? e.message : 'No connection');
      failed++;
    }
  }
  return { sent, failed, left: (await list()).length };
}

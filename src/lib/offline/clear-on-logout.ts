'use client';

/**
 * F-34: wipe on-device data caches at logout so the next person on a shared /
 * field / kiosk device cannot read the previous user's queued site notes,
 * attendance punches (incl. GPS), or recently-viewed record labels. Display-only
 * preferences (theme/density) are intentionally left in place.
 */
export function clearSensitiveClientData(): void {
  try {
    const keys = [
      'ameya.offlinePunches',   // attendance punches incl. latitude/longitude
      'ameya-outbox',           // offline write queue (site notes, expenses, …)
      'amh:recent-nav',         // recently visited records
      'amh:recent-records',
    ];
    for (const k of keys) {
      try { window.localStorage.removeItem(k); } catch { /* ignore */ }
    }
    // Best-effort: drop any IndexedDB databases holding queued PII.
    const idb = window.indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string }[]> };
    idb?.databases?.().then((dbs) => {
      for (const d of dbs) if (d.name) try { window.indexedDB.deleteDatabase(d.name); } catch { /* ignore */ }
    }).catch(() => { /* ignore */ });
  } catch { /* never block logout on cleanup */ }
}

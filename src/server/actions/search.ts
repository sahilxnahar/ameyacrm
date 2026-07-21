'use server';

import { getActionContext } from './_helpers';
import { globalSearch, type SearchHit } from '@/server/services/search-service';

export type CommandHit = SearchHit;

/**
 * Search records for the command palette. A thin, authenticated wrapper around
 * `globalSearch` so the client palette can look up leads, tasks, buyers, parcels
 * and the rest as you type — turning ⌘K from a page launcher into a launcher for
 * everything. Returns an empty list rather than throwing on any error, because a
 * search box must never break the screen it sits on.
 */
export async function searchRecords(q: string): Promise<CommandHit[]> {
  try {
    await getActionContext(); // must be signed in
    return await globalSearch(q);
  } catch {
    return [];
  }
}

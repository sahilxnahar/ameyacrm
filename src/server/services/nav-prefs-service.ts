import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';

/**
 * The sidebar layout, read once per request.
 *
 * This runs on every page load in the app, so it is cached — without it, every
 * navigation costs an extra round trip to the database for one JSON column.
 */
export const getNavPrefsRow = cache(async (userId: string): Promise<{ navPrefs: unknown; topNavPrefs: unknown } | null> => {
  // Both layouts come back in ONE query: this runs on every page load, and a
  // second round trip for a second JSON column on the same row is pure waste.
  return prisma.user.findUnique({ where: { id: userId }, select: { navPrefs: true, topNavPrefs: true } });
});

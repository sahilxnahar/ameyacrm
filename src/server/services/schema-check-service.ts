import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';

/**
 * Is the database behind the code?
 *
 * Deploying without running the migration is the single most confusing failure
 * this app has: a dozen unrelated screens start saying "something went wrong",
 * the app appears to hang, and nothing points at the cause. This checks once
 * per request and says so plainly.
 */
const REQUIRED: Array<[string, string]> = [
  ['Task', 'repeatEvery'],
  ['Voucher', 'utr'],
  ['Vendor', 'bankIfsc'],
  ['DocChunk', 'requiredPermission'],
  ['User', 'activeProjectId'],
  ['TrustedDevice', 'lastSeenAt'],
  ['MailThreadMessage', 'vendorId'],
];
const REQUIRED_TABLES = [
  'Voucher', 'MessageTemplate', 'IntegrationConnection',
  'UserOnboarding', 'MarketingAudit', 'WhatsappSession',
];

export interface SchemaState { behind: boolean; missing: string[] }

export const checkSchema = cache(async (): Promise<SchemaState> => {
  try {
    const cols = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'
    `;
    const have = new Set(cols.map((c) => `${c.table_name}.${c.column_name}`));
    const tables = new Set(cols.map((c) => c.table_name));

    const missing = [
      ...REQUIRED_TABLES.filter((t) => !tables.has(t)).map((t) => `table ${t}`),
      ...REQUIRED.filter(([t, c]) => tables.has(t) && !have.has(`${t}.${c}`)).map(([t, c]) => `${t}.${c}`),
    ];
    return { behind: missing.length > 0, missing };
  } catch {
    // If the check itself cannot run, say nothing rather than cry wolf.
    return { behind: false, missing: [] };
  }
});

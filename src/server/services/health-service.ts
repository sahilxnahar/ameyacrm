import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { checkSchema } from './schema-check-service';
import { capabilityStatus, type Capability } from '@/lib/resilience/capabilities';

export type Health = 'ok' | 'warn' | 'down';
export interface Subsystem { key: string; label: string; status: Health; detail: string }
export interface HealthStat { label: string; value: string }
export interface HealthReport {
  overall: Health;
  checkedAt: Date;
  core: Subsystem[];
  capabilities: Subsystem[];
  stats: HealthStat[];
  slowQueryMs: number;
}

const CAP_LABEL: Record<Capability, string> = {
  ai: 'AI provider', whatsapp: 'WhatsApp', email: 'Email', sms: 'SMS', maps: 'Maps', storage: 'File storage',
};

const worst = (list: Subsystem[]): Health =>
  list.some((s) => s.status === 'down') ? 'down' : list.some((s) => s.status === 'warn') ? 'warn' : 'ok';

/**
 * One read-only snapshot of the whole ecosystem's health, for the admin board.
 * Every probe is wrapped so that one failing check never takes the page down —
 * a health page that itself errors is worse than useless.
 */
export async function getHealthReport(): Promise<HealthReport> {
  const checkedAt = new Date();
  const core: Subsystem[] = [];

  // Database connectivity + round-trip latency, measured right now.
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const ms = Date.now() - t0;
    core.push({
      key: 'db',
      label: 'Database',
      status: ms < 300 ? 'ok' : ms < 900 ? 'warn' : 'down',
      detail: ms < 300 ? `Responding in ${ms} ms` : ms < 900 ? `A little slow — ${ms} ms (often a cold instance waking up)` : `Very slow — ${ms} ms`,
    });
  } catch {
    core.push({ key: 'db', label: 'Database', status: 'down', detail: 'Could not reach the database' });
  }

  // Is the live schema what this build expects?
  try {
    const schema = await checkSchema();
    core.push({
      key: 'schema',
      label: 'Database schema',
      status: schema.behind ? 'warn' : 'ok',
      detail: schema.behind
        ? `${schema.missing.length} item${schema.missing.length === 1 ? '' : 's'} behind — run this version's migration SQL in Neon`
        : 'Up to date with the code',
    });
  } catch {
    core.push({ key: 'schema', label: 'Database schema', status: 'warn', detail: 'Could not verify the schema' });
  }

  // Optional integrations. Not being configured is amber (a to-do), never a
  // failure — the app is designed to run without any of them.
  const caps = capabilityStatus();
  const capabilities: Subsystem[] = (Object.keys(caps) as Capability[]).map((c) => ({
    key: c,
    label: CAP_LABEL[c],
    status: caps[c] ? 'ok' : 'warn',
    detail: caps[c] ? 'Connected' : 'Not connected (optional)',
  }));

  // A few live numbers for context. Each is independent so one failure is fine.
  const stats: HealthStat[] = [];
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  try { stats.push({ label: 'Active users', value: (await prisma.user.count({ where: { status: 'ACTIVE' } })).toLocaleString('en-IN') }); } catch { /* skip */ }
  try { stats.push({ label: 'Unread notifications', value: (await prisma.notification.count({ where: { readAt: null } })).toLocaleString('en-IN') }); } catch { /* skip */ }
  try { stats.push({ label: 'Telemetry readings (24h)', value: (await prisma.siteReading.count({ where: { recordedAt: { gt: dayAgo } } })).toLocaleString('en-IN') }); } catch { /* skip */ }
  try { stats.push({ label: 'Rate-limit windows tracked', value: (await prisma.rateLimit.count()).toLocaleString('en-IN') }); } catch { /* skip */ }

  const slowQueryMs = Number(process.env.SLOW_QUERY_MS ?? 800);

  return { overall: worst(core), checkedAt, core, capabilities, stats, slowQueryMs };
}

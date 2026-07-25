import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { encrypt, decryptSafe, looksEncrypted } from '@/lib/utils/crypto';
import { driverMeta } from '@/config/connector-drivers';
import { driverFor } from '@/lib/connectors/registry';

/**
 * The connector runtime: stores credentials encrypted, and fans CRM events out to
 * every installed, enabled connector that has a working driver and is subscribed
 * to the event. Credentials never leave here in clear — secret fields are
 * AES-encrypted at rest and only decrypted at the moment of a send/test.
 */

const SECRET_MASK = '••••••••';

/** A config key that must be stored encrypted — driver-declared, or any *Secret/*Token. */
function secretKeysFor(slug: string): Set<string> {
  const meta = driverMeta(slug);
  return new Set((meta?.fields ?? []).filter((f) => f.secret).map((f) => f.key));
}
function isSecretKey(slug: string, key: string): boolean {
  return secretKeysFor(slug).has(key) || /secret|token/i.test(key);
}

/** Encrypt secret fields in an incoming config, preserving unchanged secrets. */
export function sealConfig(slug: string, incoming: Record<string, unknown>, existing: Record<string, unknown> | null): Record<string, unknown> {
  const secretKeys = { has: (k: string) => isSecretKey(slug, k) };
  const out: Record<string, unknown> = { ...(existing ?? {}) };
  for (const [k, v] of Object.entries(incoming)) {
    if (secretKeys.has(k)) {
      // Blank or the mask means "keep what's already stored".
      if (v === '' || v === SECRET_MASK || v == null) continue;
      out[k] = looksEncrypted(String(v)) ? v : encrypt(String(v));
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Decrypt secret fields for use by a driver. */
export function openConfig(config: Record<string, unknown> | null): Record<string, unknown> {
  if (!config) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    out[k] = typeof v === 'string' && looksEncrypted(v) ? decryptSafe(v) : v;
  }
  return out;
}

/** Config for the configure form: secrets masked, non-secrets in clear. */
export function maskConfig(slug: string, config: Record<string, unknown> | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config ?? {})) {
    out[k] = isSecretKey(slug, k) ? (v ? SECRET_MASK : '') : v;
  }
  return out;
}

/**
 * Fan a CRM event out to every enabled connector subscribed to it. Best-effort
 * and isolated: one connector's failure never affects another or the caller.
 */
export async function dispatchConnectorEvent(event: string, data: Record<string, unknown>): Promise<void> {
  let rows;
  try {
    rows = await prisma.connectorInstall.findMany({ where: { status: 'INSTALLED' } });
  } catch {
    return; // table not migrated
  }
  await Promise.all(rows.map(async (row) => {
    const driver = driverFor(row.slug);
    if (!driver) return;
    const cfg = openConfig(row.config as Record<string, unknown> | null);
    const events = Array.isArray(cfg._events) ? (cfg._events as string[]) : (driverMeta(row.slug)?.events ?? []);
    if (!events.includes(event)) return;
    await driver.send(event, data, cfg).catch(() => undefined);
  }));
}

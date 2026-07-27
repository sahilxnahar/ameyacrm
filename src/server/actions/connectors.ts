'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { connectorBySlug } from '@/config/connectors';
import { driverMeta } from '@/config/connector-drivers';
import { sealConfig, openConfig, maskConfig } from '@/server/services/connector-runtime';
import { driverFor } from '@/lib/connectors/registry';
import { LEAD_CONNECTOR_SLUGS } from '@/lib/connectors/lead-normalize';
import { randomToken } from '@/lib/utils/crypto';
import { ensure, toActionError } from './_helpers';

export type ConnectorResult = { ok: true } | { error: string };

/** Slugs of connectors this workspace has installed, with their status. */
export async function connectorInstalls(): Promise<Record<string, { status: string; config: Record<string, unknown> | null }>> {
  try {
    const rows = await prisma.connectorInstall.findMany({ select: { slug: true, status: true, config: true } });
    const out: Record<string, { status: string; config: Record<string, unknown> | null }> = {};
    for (const r of rows) out[r.slug] = { status: r.status, config: (r.config as Record<string, unknown> | null) ?? null };
    return out;
  } catch {
    return {}; // table not migrated yet
  }
}

/** Install a connector from the directory. Idempotent — re-installing re-enables it. */
export async function installConnector(slug: string): Promise<ConnectorResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const s = z.string().min(1).max(80).parse(slug);
    const def = connectorBySlug(s);
    if (!def) return { error: 'Unknown connector.' };
    await prisma.connectorInstall.upsert({
      where: { slug: s },
      update: { status: 'INSTALLED', installCount: { increment: 1 } },
      create: { slug: s, status: 'INSTALLED', installedById: ctx.user.id },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'ConnectorInstall', summary: `Installed connector ${def.name}` });
    revalidatePath('/app-exchange');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function setConnectorEnabled(slug: string, enabled: boolean): Promise<ConnectorResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const s = z.string().min(1).max(80).parse(slug);
    await prisma.connectorInstall.update({ where: { slug: s }, data: { status: enabled ? 'INSTALLED' : 'DISABLED' } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'ConnectorInstall', summary: `${enabled ? 'Enabled' : 'Disabled'} connector ${s}` });
    revalidatePath('/app-exchange');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function uninstallConnector(slug: string): Promise<ConnectorResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const s = z.string().min(1).max(80).parse(slug);
    await prisma.connectorInstall.delete({ where: { slug: s } }).catch(() => undefined);
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'ConnectorInstall', summary: `Removed connector ${s}` });
    revalidatePath('/app-exchange');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Save a connector's configuration — secret fields are encrypted at rest. */
export async function saveConnectorConfig(slug: string, config: Record<string, unknown>): Promise<ConnectorResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const s = z.string().min(1).max(80).parse(slug);
    const clean = z.record(z.string(), z.unknown()).parse(config);
    const existing = await prisma.connectorInstall.findUnique({ where: { slug: s }, select: { config: true } });
    const sealed = sealConfig(s, clean, (existing?.config as Record<string, unknown> | null) ?? null);
    await prisma.connectorInstall.upsert({
      where: { slug: s },
      update: { config: sealed as never, status: 'INSTALLED' },
      create: { slug: s, status: 'INSTALLED', config: sealed as never, installedById: ctx.user.id },
    });
    revalidatePath('/app-exchange');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Config for the configure form: secrets masked, non-secrets in clear. */
export async function getConnectorConfig(slug: string): Promise<{ ok: true; config: Record<string, unknown>; events: string[] } | { error: string }> {
  try {
    await ensure('admin.setting.manage');
    const s = z.string().min(1).max(80).parse(slug);
    const row = await prisma.connectorInstall.findUnique({ where: { slug: s }, select: { config: true } });
    const raw = (row?.config as Record<string, unknown> | null) ?? null;
    const events = Array.isArray(raw?._events) ? (raw!._events as string[]) : (driverMeta(s)?.events ?? []);
    return { ok: true, config: maskConfig(s, raw), events };
  } catch (err) { return toActionError(err); }
}

/** Generate (or rotate) a lead-portal connector's inbound secret. Returned once. */
export async function generateInboundSecret(slug: string): Promise<{ ok: true; secret: string; path: string } | { error: string }> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const s = z.string().min(1).max(80).parse(slug);
    if (!LEAD_CONNECTOR_SLUGS.includes(s)) return { error: 'This connector does not receive inbound leads.' };
    const secret = `lead_${randomToken(18)}`;
    const existing = await prisma.connectorInstall.findUnique({ where: { slug: s }, select: { config: true } });
    const sealed = sealConfig(s, { inboundSecret: secret }, (existing?.config as Record<string, unknown> | null) ?? null);
    await prisma.connectorInstall.upsert({
      where: { slug: s },
      update: { config: sealed as never, status: 'INSTALLED' },
      create: { slug: s, status: 'INSTALLED', config: sealed as never, installedById: ctx.user.id },
    });
    revalidatePath('/app-exchange');
    return { ok: true, secret, path: `/api/connectors/leads/${s}` };
  } catch (err) { return toActionError(err); }
}

/** Live test of a connector's credentials by sending a harmless test message. */
export async function testConnector(slug: string, config: Record<string, unknown>): Promise<{ ok: true; message: string } | { error: string }> {
  try {
    await ensure('admin.setting.manage');
    const s = z.string().min(1).max(80).parse(slug);
    const driver = driverFor(s);
    if (!driver) return { error: 'This connector has no live driver yet.' };
    const clean = z.record(z.string(), z.unknown()).parse(config);
    // Merge with any stored (encrypted) secrets so a masked field still tests.
    const stored = await prisma.connectorInstall.findUnique({ where: { slug: s }, select: { config: true } });
    const merged = openConfig(sealConfig(s, clean, (stored?.config as Record<string, unknown> | null) ?? null));
    const res = await driver.test(merged);
    return res.ok ? { ok: true, message: res.message } : { error: res.message };
  } catch (err) { return toActionError(err); }
}

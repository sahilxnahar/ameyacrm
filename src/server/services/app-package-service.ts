import 'server-only';
import { prisma } from '@/lib/db/prisma';
import type { AppPackage, PackageItem } from '@/config/app-packages';
import type { AutomationTrigger } from '@prisma/client';

/**
 * Provision (and de-provision) the artifacts inside an App Package. Each item
 * kind maps to a real record — the same records the single "Free Extras" install,
 * just bundled. Everything is idempotent: an artifact that already exists is
 * skipped, so re-installing never duplicates.
 */

export async function provisionItem(item: PackageItem, userId: string): Promise<void> {
  const p = item.payload;
  switch (item.kind) {
    case 'automation': {
      const exists = await prisma.automationRule.findFirst({ where: { name: String(p.name) }, select: { id: true } });
      if (exists) return;
      await prisma.automationRule.create({
        data: {
          name: String(p.name),
          description: p.description ? String(p.description) : null,
          trigger: String(p.trigger) as AutomationTrigger,
          conditions: (p.conditions ?? []) as object,
          actions: (p.actions ?? []) as object,
          isActive: false, // installed switched off — review, then enable
          createdById: userId,
        },
      });
      return;
    }
    case 'fields': {
      const entity = String(p.entity);
      const list = (p.fields as Array<{ key: string; label: string; type: string; options?: string[] }>) ?? [];
      let order = await prisma.customFieldDef.count({ where: { entity } });
      for (const f of list) {
        const exists = await prisma.customFieldDef.findFirst({ where: { entity, key: f.key }, select: { id: true } });
        if (exists) continue;
        await prisma.customFieldDef.create({ data: { entity, key: f.key, label: f.label, type: f.type, options: f.options ?? [], order: order++ } });
      }
      return;
    }
    case 'view': {
      const exists = await prisma.savedView.findFirst({ where: { name: String(p.name) }, select: { id: true } });
      if (exists) return;
      await prisma.savedView.create({ data: { name: String(p.name), entity: String(p.entity), filters: (p.filters ?? {}) as object, ownerId: userId, isShared: true } });
      return;
    }
    case 'template': {
      const exists = await prisma.emailTemplate.findUnique({ where: { key: String(p.key) }, select: { id: true } });
      if (exists) return;
      await prisma.emailTemplate.create({ data: { key: String(p.key), name: String(p.name), subject: String(p.subject ?? ''), body: String(p.body ?? '') } });
      return;
    }
    case 'connector': {
      const slug = String(p.slug);
      if (!slug) return;
      await prisma.connectorInstall.upsert({ where: { slug }, update: { status: 'INSTALLED' }, create: { slug, status: 'INSTALLED', installedById: userId } }).catch(() => undefined);
      return;
    }
  }
}

export async function deprovisionItem(item: PackageItem): Promise<void> {
  const p = item.payload;
  switch (item.kind) {
    case 'automation':
      await prisma.automationRule.deleteMany({ where: { name: String(p.name) } });
      return;
    case 'fields': {
      const entity = String(p.entity);
      const keys = ((p.fields as Array<{ key: string }>) ?? []).map((f) => f.key);
      // Deactivate, don't delete — recorded values must stay readable.
      await prisma.customFieldDef.updateMany({ where: { entity, key: { in: keys } }, data: { isActive: false } });
      return;
    }
    case 'view':
      await prisma.savedView.deleteMany({ where: { name: String(p.name) } });
      return;
    case 'template':
      await prisma.emailTemplate.deleteMany({ where: { key: String(p.key) } });
      return;
    case 'connector':
      await prisma.connectorInstall.deleteMany({ where: { slug: String(p.slug) } });
      return;
  }
}

export async function installPackage(pkg: AppPackage, userId: string, source: 'catalogue' | 'imported'): Promise<void> {
  for (const item of pkg.items) await provisionItem(item, userId);
  await prisma.appPackageInstall.upsert({
    where: { packageId: pkg.id },
    update: { name: pkg.name, source, manifest: pkg as unknown as object },
    create: { packageId: pkg.id, name: pkg.name, source, manifest: pkg as unknown as object, installedById: userId },
  });
}

export async function uninstallPackage(packageId: string): Promise<void> {
  const row = await prisma.appPackageInstall.findUnique({ where: { packageId } });
  if (!row) return;
  const pkg = row.manifest as unknown as AppPackage | null;
  if (pkg?.items) for (const item of pkg.items) await deprovisionItem(item);
  await prisma.appPackageInstall.delete({ where: { packageId } }).catch(() => undefined);
}

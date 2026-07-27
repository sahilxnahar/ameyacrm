import { describe, it, expect } from 'vitest';
import { APP_PACKAGES, appPackageById, packageSummary, APP_PACKAGE_CATEGORIES } from '@/config/app-packages';

describe('App Packages / extensibility (v15.27)', () => {
  it('every package has valid items and a known category', () => {
    const kinds = new Set(['automation', 'fields', 'view', 'template', 'connector']);
    expect(APP_PACKAGES.length).toBeGreaterThan(0);
    for (const p of APP_PACKAGES) {
      expect(p.items.length).toBeGreaterThan(0);
      expect(APP_PACKAGE_CATEGORIES).toContain(p.category);
      for (const it of p.items) expect(kinds.has(it.kind)).toBe(true);
    }
  });

  it('resolves a package by id', () => {
    expect(appPackageById('nri-sales-kit')?.name).toBe('NRI Sales Kit');
    expect(appPackageById('nope')).toBeUndefined();
  });

  it('summarises the artifacts a package creates (fields counted individually)', () => {
    const nri = appPackageById('nri-sales-kit')!;
    const s = packageSummary(nri);
    expect(s.fields).toBe(3); // three custom fields
    expect(s.automation).toBe(1);
    expect(s.view).toBe(1);
  });

  it('has unique package ids', () => {
    const ids = APP_PACKAGES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

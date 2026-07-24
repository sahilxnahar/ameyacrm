'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { SAML_DEFAULTS, buildSaml, type SamlConfig } from '@/lib/auth/saml';

export type SsoResult = { ok: true; message?: string } | { error: string };

export async function saveSsoConfig(input: Record<string, string | boolean>): Promise<SsoResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const cfg: SamlConfig = {
      ...SAML_DEFAULTS,
      enabled: Boolean(input.enabled),
      entryPoint: String(input.entryPoint ?? '').trim(),
      issuer: String(input.issuer ?? SAML_DEFAULTS.issuer).trim() || SAML_DEFAULTS.issuer,
      cert: String(input.cert ?? '').trim(),
      allowedDomains: String(input.allowedDomains ?? '')
        .split(/[\s,]+/).map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean),
      autoProvision: Boolean(input.autoProvision),
      defaultRole: String(input.defaultRole ?? 'EMPLOYEE'),
    };

    if (cfg.enabled) {
      if (!/^https?:\/\//i.test(cfg.entryPoint)) return { error: 'The sign-in URL must start with https://' };
      if (!cfg.cert.includes('BEGIN CERTIFICATE') && cfg.cert.length < 200) {
        return { error: 'That does not look like a certificate. Paste the whole thing, including the BEGIN and END lines.' };
      }
      const built = await buildSaml(cfg);
      if (!built.ok) return { error: `Settings rejected: ${built.error}` };
    }

    await prisma.setting.upsert({
      where: { key: 'sso.saml' },
      update: { value: cfg as unknown as object },
      create: { key: 'sso.saml', value: cfg as unknown as object },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'PERMISSION_CHANGE', entityType: 'Setting', summary: `Single sign-on ${cfg.enabled ? 'enabled' : 'disabled'}` });
    revalidatePath('/admin/sso');
    revalidatePath('/login');
    return {
      ok: true,
      message: cfg.enabled
        ? 'Saved. Test it in a private window before telling anyone — password login still works either way.'
        : 'Saved. Single sign-on is off; everyone uses a password.',
    };
  } catch (err) { return toActionError(err); }
}

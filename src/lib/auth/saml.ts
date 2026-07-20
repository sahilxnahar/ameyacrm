import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';

export interface SamlConfig {
  enabled: boolean;
  entryPoint: string;   // the IdP's sign-in URL
  issuer: string;       // the Entity ID the IdP expects from us
  cert: string;         // the IdP's signing certificate
  allowedDomains: string[];
  autoProvision: boolean;
  defaultRole: string;
}

export const SAML_DEFAULTS: SamlConfig = {
  enabled: false,
  entryPoint: '',
  issuer: 'ameya-heights-crm',
  cert: '',
  allowedDomains: ['ameyaheights.com'],
  autoProvision: true,
  defaultRole: 'EMPLOYEE',
};

export const callbackUrl = () => `${env.APP_URL.replace(/\/$/, '')}/api/auth/saml/callback`;

export async function getSamlConfig(): Promise<SamlConfig> {
  const row = await prisma.setting.findUnique({ where: { key: 'sso.saml' } });
  return { ...SAML_DEFAULTS, ...((row?.value ?? {}) as Partial<SamlConfig>) };
}

/**
 * Build the SAML client.
 *
 * The library is imported lazily and inside a try/catch on purpose: if it is
 * missing or fails to load, single sign-on reports itself unavailable and
 * ordinary username-and-password login carries on working. An identity
 * integration should never be able to lock everyone out.
 */
export async function buildSaml(cfg: SamlConfig): Promise<{ ok: true; saml: unknown } | { ok: false; error: string }> {
  if (!cfg.enabled) return { ok: false, error: 'Single sign-on is switched off.' };
  if (!cfg.entryPoint || !cfg.cert) return { ok: false, error: 'Single sign-on is not finished — the sign-in URL and certificate are both needed.' };
  try {
    const mod = await import('@node-saml/node-saml');
    const SAML = (mod as unknown as { SAML: new (o: Record<string, unknown>) => unknown }).SAML;
    const saml = new SAML({
      entryPoint: cfg.entryPoint,
      issuer: cfg.issuer,
      callbackUrl: callbackUrl(),
      idpCert: cfg.cert,
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: true,
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      disableRequestedAuthnContext: true,
      audience: cfg.issuer,
      acceptedClockSkewMs: 5000,
    });
    return { ok: true, saml };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not load the SAML library.' };
  }
}

/** Pull an email address out of whatever shape the IdP returned. */
export function emailFromProfile(profile: Record<string, unknown> | null | undefined): string | null {
  if (!profile) return null;
  const candidates = [
    profile.nameID, profile.email, profile.mail,
    (profile as Record<string, unknown>)['urn:oid:0.9.2342.19200300.100.1.3'],
    (profile as Record<string, unknown>)['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
  ];
  for (const c of candidates) {
    const v = typeof c === 'string' ? c : Array.isArray(c) ? String(c[0] ?? '') : '';
    if (v.includes('@')) return v.trim().toLowerCase();
  }
  return null;
}

export function nameFromProfile(profile: Record<string, unknown> | null | undefined, fallback: string): string {
  if (!profile) return fallback;
  const first = String(profile.firstName ?? profile.givenName ?? '');
  const last = String(profile.lastName ?? profile.surname ?? '');
  const display = String(profile.displayName ?? profile.cn ?? '').trim();
  const joined = `${first} ${last}`.trim();
  return display || joined || fallback;
}

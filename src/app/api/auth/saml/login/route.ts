import { NextResponse } from 'next/server';
import { getSamlConfig, buildSaml } from '@/lib/auth/saml';

export const dynamic = 'force-dynamic';

/** Send the browser to the identity provider. */
export async function GET() {
  const cfg = await getSamlConfig();
  const built = await buildSaml(cfg);
  if (!built.ok) {
    return NextResponse.redirect(`${process.env.APP_URL ?? ''}/login?sso=${encodeURIComponent(built.error)}`, 302);
  }
  try {
    const saml = built.saml as { getAuthorizeUrlAsync: (rs: string, host: string | undefined, o: object) => Promise<string> };
    const url = await saml.getAuthorizeUrlAsync('', undefined, {});
    return NextResponse.redirect(url, 302);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not start single sign-on.';
    return NextResponse.redirect(`${process.env.APP_URL ?? ''}/login?sso=${encodeURIComponent(msg)}`, 302);
  }
}

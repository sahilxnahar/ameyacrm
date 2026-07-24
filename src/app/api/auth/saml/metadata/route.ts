import { NextResponse } from 'next/server';
import { getSamlConfig, callbackUrl } from '@/lib/auth/saml';

export const dynamic = 'force-dynamic';

/** The two values Google Workspace asks for when you add a custom SAML app. */
export async function GET() {
  const cfg = await getSamlConfig();
  const xml = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${cfg.issuer}">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService index="0" isDefault="true"
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${callbackUrl()}"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
  return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml' } });
}

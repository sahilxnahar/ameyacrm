import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { getSamlConfig, callbackUrl } from '@/lib/auth/saml';
import { SsoView } from '@/components/admin/sso-view';

export const metadata: Metadata = { title: 'Single sign-on' };
export const dynamic = 'force-dynamic';

export default async function SsoPage() {
  await requirePermission('admin.setting.manage');
  const cfg = await getSamlConfig();
  return (
    <div>
      <PageHeader
        title="Single sign-on"
        description="Let people sign in with their Google Workspace account. When someone leaves the company, removing them from Workspace removes their access here too."
      />
      <SsoView config={cfg} acsUrl={callbackUrl()} />
    </div>
  );
}

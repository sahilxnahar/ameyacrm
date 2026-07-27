import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageHeader } from '@/components/layout/page-header';
import { isAppsScriptConfigured, gasPing, gasList } from '@/lib/google/appscript';
import { GoogleView } from '@/components/google/google-view';

export const metadata: Metadata = { title: 'Google Sheets & Drive' };
export const dynamic = 'force-dynamic';

export default async function GooglePage() {
  const ctx = await requirePermission('dashboard.view');
  const configured = isAppsScriptConfigured();

  let folder: string | null = null;
  let statusError: string | null = null;
  let files: Array<{ id: string; name: string; mimeType: string; url: string }> = [];

  if (configured) {
    const [ping, list] = await Promise.all([gasPing(), gasList([])]);
    if ('error' in ping) statusError = ping.error;
    else folder = ping.folder;
    if ('files' in list) files = list.files.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, url: f.url })).slice(0, 100);
  }

  const can = {
    leads: ctx.permissions.isSuperAdmin || ctx.permissions.keys.has('lead.view'),
    vendors: ctx.permissions.isSuperAdmin || ctx.permissions.keys.has('billing.view'),
    bookings: ctx.permissions.isSuperAdmin || ctx.permissions.keys.has('booking.view'),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Google Sheets & Drive"
        description="Push CRM lists into your Google Sheet and browse your Drive folder — through your own Apps Script connector, with no Google Cloud Console."
      />
      <GoogleView configured={configured} folder={folder} statusError={statusError} files={files} can={can} />
    </div>
  );
}

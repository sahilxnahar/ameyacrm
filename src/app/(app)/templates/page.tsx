import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { templatesFor } from '@/server/services/template-access-service';
import { departmentsFor } from '@/server/services/department-service';
import { MyTemplatesView } from '@/components/templates/my-templates-view';

export const metadata: Metadata = { title: 'Templates' };
export const dynamic = 'force-dynamic';

export default async function MyTemplatesPage() {
  const ctx = await requireAuth();
  const seesEverything = can(ctx.permissions, 'email.template.manage');

  try {
    const [templates, departments] = await Promise.all([
      templatesFor(ctx.user.id, { seesEverything }),
      departmentsFor(ctx.user.id),
    ]);
    return (
      <div className="space-y-6">
        <PageHeader
          title="Templates"
          description={
            seesEverything
              ? 'Every template in the company. Copy one, change the wording, send it.'
              : 'Wording your department has already agreed. Copy one, fill in the blanks, send it.'
          }
        />
        <MyTemplatesView
          templates={templates}
          departments={departments}
          seesEverything={seesEverything}
        />
      </div>
    );
  } catch (e) {
    return (
      <div className="space-y-6">
        <PageHeader title="Templates" description="Wording your department has already agreed." />
        <PageLoadError error={e} />
      </div>
    );
  }
}

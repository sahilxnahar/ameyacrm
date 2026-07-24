import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-load-error';
import { getWorkRequestInbox, userDeptIds } from '@/server/services/workrequest-service';
import { WorkRequestsView } from '@/components/workrequests/work-requests-view';

export const metadata: Metadata = { title: 'Work Requests' };
export const dynamic = 'force-dynamic';

export default async function WorkRequestsPage() {
  const ctx = await requirePermission('workrequest.view');
  try {
    const myDepts = await userDeptIds(ctx.user.id);
    const [inbox, departments] = await Promise.all([
      getWorkRequestInbox(ctx.user.id, myDepts),
      prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    // A person raises requests to departments other than their own.
    const otherDepts = departments.filter((d) => !myDepts.includes(d.id));
    return (
      <div className="space-y-6">
        <PageHeader title="Work Requests" description="Ask another department to get something done — and track it from raised to confirmed, with a clear owner and a record of every step." />
        <WorkRequestsView
          incoming={inbox.incoming}
          outgoing={inbox.outgoing}
          departments={otherDepts}
          canCreate={can(ctx.permissions, 'workrequest.create')}
          canManage={can(ctx.permissions, 'workrequest.manage')}
        />
      </div>
    );
  } catch (e) {
    return <div className="space-y-6"><PageHeader title="Work Requests" description="Inter-department requests." /><PageLoadError error={e} /></div>;
  }
}

import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { getSandboxData } from '@/server/services/sandbox-service';
import { DemoTasks } from '@/components/demo/demo-tasks';

export const metadata: Metadata = { title: 'Tasks — Demo' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { user } = await requireAuth();
  const data = await getSandboxData(user.id);
  return <DemoTasks data={data} />;
}

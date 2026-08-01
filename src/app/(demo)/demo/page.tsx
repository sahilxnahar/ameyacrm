import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { getSandboxData } from '@/server/services/sandbox-service';
import { DemoOverview } from '@/components/demo/demo-overview';

export const metadata: Metadata = { title: 'Demo workspace' };
export const dynamic = 'force-dynamic';

export default async function DemoHomePage() {
  const { user } = await requireAuth();
  const data = await getSandboxData(user.id);
  return <DemoOverview data={data} name={user.name} />;
}

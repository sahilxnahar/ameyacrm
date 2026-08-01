import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { getSandboxData } from '@/server/services/sandbox-service';
import { DemoSales } from '@/components/demo/demo-sales';

export const metadata: Metadata = { title: 'Sales — Demo' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { user } = await requireAuth();
  const data = await getSandboxData(user.id);
  return <DemoSales data={data} />;
}

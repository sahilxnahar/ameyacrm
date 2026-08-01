import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { getSandboxData } from '@/server/services/sandbox-service';
import { DemoInventory } from '@/components/demo/demo-inventory';

export const metadata: Metadata = { title: 'Inventory — Demo' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { user } = await requireAuth();
  const data = await getSandboxData(user.id);
  return <DemoInventory data={data} />;
}

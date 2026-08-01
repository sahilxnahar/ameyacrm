import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { getSandboxData } from '@/server/services/sandbox-service';
import { DemoBooks } from '@/components/demo/demo-books';

export const metadata: Metadata = { title: 'Ameya Tally — Demo' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { user } = await requireAuth();
  const data = await getSandboxData(user.id);
  return <DemoBooks data={data} />;
}

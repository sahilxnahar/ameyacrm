import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { getCommandCenter } from '@/server/services/command-center-service';
import { BentoCommandCenter } from '@/components/dashboard/bento-command-center';

export const metadata: Metadata = { title: 'Command Center' };
export const dynamic = 'force-dynamic';

export default async function CommandCenterPage() {
  const { user } = await requireAuth();
  const { tiles, urgent } = await getCommandCenter();
  return <BentoCommandCenter tiles={tiles} urgent={urgent} firstName={user.name.split(' ')[0] ?? 'there'} />;
}

import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/current-user';
import { getCommandCenter, getLaunchpadBadges } from '@/server/services/command-center-service';
import { BentoCommandCenter } from '@/components/dashboard/bento-command-center';
import { Launchpad } from '@/components/dashboard/launchpad';

export const metadata: Metadata = { title: 'Launchpad' };
export const dynamic = 'force-dynamic';

export default async function CommandCenterPage() {
  const { user } = await requireAuth();
  const [{ tiles, urgent }, badges] = await Promise.all([getCommandCenter(), getLaunchpadBadges()]);
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Apps</h2>
        <Launchpad badges={badges} />
      </section>
      <section id="alerts" className="scroll-mt-24">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Alerts</h2>
        <BentoCommandCenter tiles={tiles} urgent={urgent} firstName={user.name.split(' ')[0] ?? 'there'} />
      </section>
    </div>
  );
}

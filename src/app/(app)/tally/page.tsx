import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { PageLoadError } from '@/components/layout/page-load-error';
import { getTallyData } from '@/server/services/tally-service';
import { prisma } from '@/lib/db/prisma';
import { readTallyPrefs } from '@/lib/tally/prefs';
import { TallyApp } from '@/components/tally/tally-app';

export const metadata: Metadata = { title: 'Ameya Tally' };
export const dynamic = 'force-dynamic';

export default async function TallyPage() {
  const ctx = await requirePermission('finance.ledger.view');
  try {
    const [data, userRow] = await Promise.all([
      getTallyData(),
      prisma.user.findUnique({ where: { id: ctx.user.id }, select: { tallyPrefs: true } }),
    ]);
    return <TallyApp data={data} prefs={readTallyPrefs(userRow?.tallyPrefs)} />;
  } catch (e) {
    return <div className="space-y-4"><PageLoadError error={e} /></div>;
  }
}

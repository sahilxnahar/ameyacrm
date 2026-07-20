import type { Metadata } from 'next';
import Link from 'next/link';
import { BellRing, CheckSquare, Inbox, PhoneCall, Flame, Wallet, CheckCircle2 } from 'lucide-react';
import { requireAuth } from '@/lib/auth/current-user';
import { getTodayList, type TodayItem, type Urgency } from '@/server/services/today-service';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { prisma } from '@/lib/db/prisma';
import { can } from '@/lib/rbac/can';
import { ONBOARDING } from '@/config/onboarding';
import { OnboardingChecklist } from '@/components/onboarding/onboarding-checklist';

export const metadata: Metadata = { title: "Today's priorities" };

const ICON = { reminder: BellRing, task: CheckSquare, approval: Inbox, followup: PhoneCall, lead: Flame, payment: Wallet } as const;
const TONE: Record<Urgency, string> = {
  overdue: 'border-l-rose-500 bg-rose-500/[0.04]',
  today: 'border-l-amber-500 bg-amber-500/[0.04]',
  soon: 'border-l-slate-300',
};
const GROUPS: { key: Urgency; label: string }[] = [
  { key: 'overdue', label: 'Overdue — do first' },
  { key: 'today', label: 'Due today' },
  { key: 'soon', label: 'Coming up this week' },
];

function Row({ item }: { item: TodayItem }) {
  const Icon = ICON[item.kind];
  return (
    <Link href={item.href}>
      <div className={`flex items-start gap-2.5 border-l-2 px-3 py-2 transition-colors hover:bg-secondary/50 ${TONE[item.urgency]}`}>
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-tight">{item.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">{item.detail}</p>
        </div>
        {item.when && <span className="shrink-0 text-[10px] text-muted-foreground">{item.when}</span>}
      </div>
    </Link>
  );
}

export default async function TodayPage() {
  const ctx = await requireAuth();
  const user = ctx.user;
  const items = await getTodayList(user.id);
  const counts = { overdue: items.filter((i) => i.urgency === 'overdue').length, today: items.filter((i) => i.urgency === 'today').length };


  const isAdmin = can(ctx.permissions, 'admin.setting.manage');
  const steps = ONBOARDING.filter((s) => !s.adminOnly || isAdmin);
  const doneRows = await prisma.onboardingStep.findMany({
    where: { userId: ctx.user.id, completedAt: { not: null } },
    select: { stepKey: true },
  });
  return (
    <div className="max-w-md">
      <OnboardingChecklist steps={steps} doneKeys={doneRows.map((d) => d.stepKey)} />
      <PageHeader title="Today's priorities" description={items.length ? `${counts.overdue} overdue · ${counts.today} due today` : 'Your day, in one column.'} />
      {items.length === 0 ? (
        <Card className="p-10 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
          <p className="text-sm font-medium">Nothing pending</p>
          <p className="text-xs text-muted-foreground">No overdue work, follow-ups or approvals on your plate.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {GROUPS.map(({ key, label }) => {
            const group = items.filter((i) => i.urgency === key);
            if (!group.length) return null;
            return (
              <div key={key}>
                <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label} ({group.length})</p>
                <Card className="divide-y overflow-hidden">{group.map((i, idx) => <Row key={`${i.kind}-${idx}`} item={i} />)}</Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

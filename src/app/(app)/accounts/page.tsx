import type { Metadata } from 'next';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  IndianRupee, PieChart, Repeat, LockKeyhole, BookOpen, FileJson, Banknote, PiggyBank, HandCoins, ArrowRight,
} from 'lucide-react';
import { requireAuth } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Accounts & books' };

interface Tool { label: string; href: string; icon: LucideIcon; permission: string; blurb: string }
interface Section { title: string; tools: Tool[] }

// The heavier accounting & funding tools, moved off the main Money menu to keep
// it simple. Everything here is still one click away and searchable (⌘K).
const SECTIONS: Section[] = [
  {
    title: 'Getting paid',
    tools: [
      { label: 'Payment Requests', href: '/payment-requests', icon: IndianRupee, permission: 'billing.view', blurb: 'Money being asked for — awaiting approval.' },
    ],
  },
  {
    title: 'Paying out',
    tools: [
      { label: 'Recurring Payments', href: '/recurring', icon: Repeat, permission: 'finance.ledger.view', blurb: 'Salaries, rent, EMIs and subscriptions — on time.' },
      { label: 'Expense Claims', href: '/expenses', icon: HandCoins, permission: 'people.view', blurb: 'Money staff spent and want back.' },
      { label: 'Vendor Ledgers', href: '/ledgers', icon: BookOpen, permission: 'finance.ledger.view', blurb: 'One ledger per payee — payments and bank details.' },
      { label: 'Spend Report', href: '/spend', icon: PieChart, permission: 'finance.ledger.view', blurb: 'Where the money went — by category, project, payee, month.' },
    ],
  },
  {
    title: 'The books',
    tools: [
      { label: 'Ledger', href: '/ledger', icon: BookOpen, permission: 'finance.ledger.view', blurb: 'The full accounting record.' },
      { label: 'Ameya Tally', href: '/tally', icon: BookOpen, permission: 'finance.ledger.view', blurb: 'Keyboard accounting — vouchers, Day Book, Trial Balance, P&L.' },
      { label: 'GST Filing', href: '/gst-filing', icon: FileJson, permission: 'finance.ledger.view', blurb: 'Filing-ready GSTR-1 / e-invoice / e-way-bill JSON.' },
      { label: 'Secret Cash Book', href: '/secret-cash-book', icon: LockKeyhole, permission: 'finance.ledger.view', blurb: 'A private, OTP-locked cash book.' },
    ],
  },
  {
    title: 'Funding & banking',
    tools: [
      { label: 'Borrowings', href: '/borrowings', icon: Banknote, permission: 'treasury.view', blurb: 'Bank & NBFC loans, drawdowns and interest.' },
      { label: 'Cash Flow & Treasury', href: '/treasury', icon: Banknote, permission: 'treasury.view', blurb: 'Bank position, reconciliation and forecast.' },
      { label: 'Capital & Escrow', href: '/capital', icon: PiggyBank, permission: 'capital.view', blurb: 'Investors and the RERA escrow account.' },
    ],
  },
];

export default async function AccountsPage() {
  const ctx = await requireAuth();
  const sections = SECTIONS
    .map((s) => ({ ...s, tools: s.tools.filter((t) => can(ctx.permissions, t.permission)) }))
    .filter((s) => s.tools.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Accounts & books" description="Your accounting, tax and funding tools in one place. Everyday money tasks stay in the Money menu." />
      {sections.map((s) => (
        <div key={s.title}>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{s.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {s.tools.map((t) => {
              const Icon = t.icon;
              return (
                <Link key={t.href} href={t.href}>
                  <Card interactive className="flex items-start gap-3 p-4">
                    <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 font-medium">{t.label} <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /></p>
                      <p className="text-xs text-muted-foreground">{t.blurb}</p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

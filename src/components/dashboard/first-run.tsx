import Link from 'next/link';
import { Users2, Building2, BookOpen, Upload, ArrowRight, Sparkles } from 'lucide-react';

/**
 * What the home screen shows before anything has been entered.
 *
 * It replaces a row of zeros. "0 new leads · 0% win rate · 0% collections" is
 * accurate and useless: a percentage of nothing is not a measurement, and it
 * gives somebody opening the CRM for the first time no idea what to do. Four
 * concrete first steps do.
 *
 * This disappears on its own the moment a lead or a unit exists — there is no
 * flag to set and nothing to dismiss.
 */
const STEPS = [
  {
    href: '/inventory',
    icon: Building2,
    title: 'Add your flats',
    body: 'Towers, floors and units, with their prices. Everything in sales hangs off this, so it is the right place to start.',
    cta: 'Open Inventory',
  },
  {
    href: '/sales',
    icon: Users2,
    title: 'Bring in your leads',
    body: 'Add an enquiry by hand, import a spreadsheet, or connect a portal so enquiries arrive on their own.',
    cta: 'Open Sales',
  },
  {
    href: '/tally/import',
    icon: BookOpen,
    title: 'Import your books',
    body: 'Bring your ledgers, opening balances and vouchers over from Tally. You can preview everything before it is written.',
    cta: 'Import from Tally',
  },
  {
    href: '/documents',
    icon: Upload,
    title: 'Upload your documents',
    body: 'Agreements, approvals, drawings. They are read and indexed, so you can search inside them later.',
    cta: 'Open Documents',
  },
];

export function FirstRun() {
  return (
    <div className="mt-4">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
        <p className="flex items-center gap-2 font-display text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-primary" /> Let’s get your CRM working
        </p>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          There is nothing in here yet, so the numbers below would all read zero. Do any one of these
          and this screen starts filling in on its own — you do not have to do them in order.
        </p>
      </div>

      <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {STEPS.map(({ href, icon: Icon, title, body, cta }) => (
          <Link
            key={href}
            href={href}
            className="focus-ring card-elevated group flex flex-col rounded-lg border bg-background p-4 transition-colors hover:bg-secondary/40"
          >
            <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <p className="font-medium">{title}</p>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
              {cta}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-3 text-center text-sm text-muted-foreground">
        Would rather look around first? <Link href="/guide" className="font-medium text-primary hover:underline">Open the Guide</Link>
        {' '}or press <kbd className="rounded border bg-background px-1.5 py-0.5 text-[11px]">⌘K</kbd> to jump to any screen.
      </p>
    </div>
  );
}

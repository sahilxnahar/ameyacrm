import Image from 'next/image';
import Link from 'next/link';
import { brand } from '@/config/brand';
import { cn } from '@/lib/utils/cn';

/**
 * Ameya Heights medallion mark + wordmark.
 *
 * The mark is an interlaced knot with fine strokes, so it needs room: at 32px
 * the weave closed up into a blur. It is rendered larger and from the metal
 * gradient asset, which keeps the strands readable.
 */
export function BrandLogo({
  collapsed = false,
  className,
  href = '/dashboard',
  onClick,
}: {
  collapsed?: boolean;
  className?: string;
  /** Where the mark leads. Pass null on the sign-in page, where there is nowhere to go. */
  href?: string | null;
  /** Lets the mobile drawer close itself when the mark is used to navigate. */
  onClick?: () => void;
}) {
  const inner = (
    <>
      <Image
        src={brand.assets.markGoldMetal}
        alt={brand.company.displayName}
        width={128}
        height={128}
        priority
        className="h-11 w-11 shrink-0 drop-shadow-[0_1px_2px_rgba(16,15,13,0.18)] transition-transform duration-200 group-hover:scale-[1.04]"
      />
      {!collapsed && (
        <div className="leading-none">
          <div className="font-display text-[1.35rem] font-semibold leading-none tracking-[0.01em] text-[#8C6E2C] dark:text-[#D9BE79]">
            {brand.company.displayName}
          </div>
          <div className="mt-1 text-[9px] font-medium uppercase tracking-[0.34em] text-muted-foreground">CRM</div>
        </div>
      )}
    </>
  );

  if (!href) return <div className={cn('flex items-center gap-3', className)}>{inner}</div>;

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={`${brand.company.displayName} — go to the dashboard`}
      title="Go to the dashboard"
      className={cn('focus-ring group -mx-1 flex items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-secondary/50', className)}
    >
      {inner}
    </Link>
  );
}

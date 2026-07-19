import Image from 'next/image';
import { brand } from '@/config/brand';
import { cn } from '@/lib/utils/cn';

/** Ameya Heights medallion mark + wordmark. Assets come from the brand kit. */
export function BrandLogo({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Image src={brand.assets.markGoldDark} alt={brand.company.displayName} width={32} height={32} className="h-8 w-8" priority />
      {!collapsed && (
        <div className="leading-tight">
          <div className="font-display text-lg font-semibold tracking-wide">{brand.company.displayName}</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">CRM</div>
        </div>
      )}
    </div>
  );
}

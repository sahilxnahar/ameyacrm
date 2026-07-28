import { cn } from '@/lib/utils/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-md', className)} />;
}

/** Placeholder shaped like a page: header, stat row, then a list. */
export function PageSkeleton({ stats = 4, rows = 6 }: { stats?: number; rows?: number }) {
  return (
    <div className="animate-in">
      <div className="mb-5 space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {stats > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: stats }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-14" />)}
      </div>
    </div>
  );
}

/** Ameya OS Launchpad placeholder — the app grid, zero layout shift. */
export function LaunchpadSkeleton({ cards = 8 }: { cards?: number }) {
  return (
    <div className="animate-in space-y-8">
      <section className="space-y-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="min-h-[7rem] rounded-2xl border bg-card p-4 sm:min-h-[8.5rem]">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <Skeleton className="mt-4 h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <Skeleton className="h-4 w-16" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </section>
    </div>
  );
}

/** Due Diligence vault placeholder — stat row, search, accordion, list. */
export function VaultSkeleton() {
  return (
    <div className="animate-in space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
      </div>
    </div>
  );
}

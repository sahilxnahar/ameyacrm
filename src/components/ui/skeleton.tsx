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

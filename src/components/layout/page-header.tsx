import { cn } from '@/lib/utils/cn';

export function PageHeader({
  title, description, children, className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div>
        <h1 className="gold-shine font-display text-xl font-semibold leading-tight tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="chip-row items-center sm:flex sm:gap-2">{children}</div>}
    </div>
  );
}

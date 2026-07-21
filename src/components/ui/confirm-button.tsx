'use client';
import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * A destructive action should never fire on a single stray click. This wraps one
 * in a two-step confirm: the first click asks "Sure?" in place, and only the
 * second (on the confirm) runs it. It reverts on its own after a few seconds or
 * when you click away, so a half-pressed delete never lingers.
 */
export function ConfirmButton({
  onConfirm, children, confirmLabel = 'Sure?', className, disabled, title,
}: {
  onConfirm: () => void;
  children: React.ReactNode;
  confirmLabel?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  const [armed, setArmed] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const disarm = () => { setArmed(false); if (timer.current) clearTimeout(timer.current); };

  const onClick = () => {
    if (disabled) return;
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    disarm();
    onConfirm();
  };

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      onBlur={disarm}
      className={cn(
        'inline-flex items-center gap-1 rounded-md text-sm transition-colors disabled:opacity-50',
        armed && 'bg-destructive px-2 py-1 font-medium text-destructive-foreground',
        className,
      )}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

'use client';
import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * A sheet that slides up from the bottom — the native-feeling replacement for a
 * centre-screen dialog on phones. Thumb-reachable, dismissable by tapping the
 * backdrop or dragging the grabber. Renders nothing when closed.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    // Stop the page behind from scrolling while the sheet is up.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in" onClick={onClose} aria-hidden />
      <div
        className={cn(
          'relative w-full max-w-lg rounded-t-2xl border-t bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:border',
          'motion-safe:animate-in',
          className,
        )}
        style={{ animation: 'sheet-up 220ms cubic-bezier(0.16,1,0.3,1) both' }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/30 sm:hidden" aria-hidden />
        {title && <p className="mb-3 text-base font-semibold">{title}</p>}
        {children}
      </div>
      <style>{`@keyframes sheet-up{from{transform:translateY(100%)}to{transform:none}}@media (prefers-reduced-motion: reduce){@keyframes sheet-up{from{transform:none}to{transform:none}}}`}</style>
    </div>
  );
}

'use client';
import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * <DropZone /> — wraps any existing file-picker UI (a button, an avatar, a form
 * field) and adds drag-and-drop on top of it, without changing that UI's own
 * click behaviour. Drop one or more files and `onFiles` fires; a soft overlay
 * shows while a drag is over the area. Purely additive — the wrapped control
 * still works exactly as before for people who prefer to click.
 */
export function DropZone({
  onFiles,
  disabled,
  className,
  overlayLabel = 'Drop to upload',
  children,
}: {
  onFiles: (files: FileList) => void;
  disabled?: boolean;
  className?: string;
  overlayLabel?: string;
  children: React.ReactNode;
}) {
  const [over, setOver] = React.useState(false);

  return (
    <div
      onDragOver={(e) => { if (disabled) return; e.preventDefault(); setOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (disabled) return;
        if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
      }}
      className={cn('relative rounded-lg transition-colors', over && 'outline-dashed outline-2 outline-offset-2 outline-primary', className)}
    >
      {children}
      {over ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/5 text-xs font-semibold text-primary">
          {overlayLabel}
        </div>
      ) : null}
    </div>
  );
}

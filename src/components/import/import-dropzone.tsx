'use client';
import * as React from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { SPREADSHEET_ACCEPT } from '@/lib/import/read-spreadsheet';

/**
 * One drag-and-drop file picker used by every import in the app (ledgers,
 * leads, bank statements). Drag a file onto it, or click to browse — either
 * way the chosen file is handed to `onFile`. Accepts CSV and Excel by default.
 */
export function ImportDropzone({
  onFile,
  disabled,
  accept = SPREADSHEET_ACCEPT,
  title = 'Drag & drop a CSV or Excel file here',
  hint = 'or click to browse — .csv, .xlsx and .xls all work',
  className,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  accept?: string;
  title?: string;
  hint?: string;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);

  const take = (file: File | undefined) => {
    if (file && !disabled) onFile(file);
  };
  const open = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files?.[0]);
      }}
      className={cn(
        'focus-ring flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-input px-4 py-6 text-center transition-colors hover:border-[#A07D34]/60 hover:bg-secondary/40',
        over && 'border-[#A07D34] bg-[#A07D34]/10',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <UploadCloud className={cn('h-6 w-6 text-muted-foreground', over && 'text-[#A07D34]')} />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

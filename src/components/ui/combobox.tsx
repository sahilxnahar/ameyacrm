'use client';
import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * A searchable select (combobox). Batch 7 (forms): a project, a vendor or an
 * activity is picked by typing, not by scrolling a long native `<select>` — the
 * everyday control once the master data is real and a dropdown has hundreds of
 * entries. Built on Radix Popover + cmdk (both already dependencies), keyboard
 * accessible, and it falls back to the plain `<Select>` where the list is short.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No match.',
  className,
  disabled,
  name,
}: {
  options: ComboOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  /** When set, a hidden input carries the value so the combobox works inside a
   *  plain <form> submitted via FormData, like the native controls it replaces. */
  name?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <>
      {name && <input type="hidden" name={name} value={value ?? ''} readOnly />}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-expanded={open}
            className={cn(
              'focus-ring flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50',
              className,
            )}
          >
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>{selected ? selected.label : placeholder}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[12rem] overflow-hidden rounded-md border bg-popover p-0 text-popover-foreground shadow-md"
          >
            <Command>
              <Command.Input placeholder={searchPlaceholder} className="h-9 w-full border-b bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground" />
              <Command.List className="max-h-60 overflow-y-auto p-1">
                <Command.Empty className="p-3 text-sm text-muted-foreground">{emptyText}</Command.Empty>
                {options.map((o) => (
                  <Command.Item
                    key={o.value}
                    value={`${o.label} ${o.value}`}
                    onSelect={() => { onChange(o.value); setOpen(false); }}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm aria-selected:bg-secondary"
                  >
                    <Check className={cn('h-4 w-4 shrink-0', o.value === value ? 'opacity-100' : 'opacity-0')} />
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint && <span className="shrink-0 text-xs text-muted-foreground">{o.hint}</span>}
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}

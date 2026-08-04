import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * A form field: label, the control, an optional hint and an optional error, with
 * the spacing owned once. Before this every screen wrote its own `Field` and a
 * bare `inputCls` string; a form is now a list of `<Field>`s, not forty lines of
 * Tailwind, and an inline error has one place to live.
 *
 * ── Why the label WRAPS the control (AMH-013) ───────────────────────────────
 *
 * This component took an `htmlFor` prop and rendered `<label htmlFor=…>` as a
 * SIBLING of the control. That only associates the two if the caller also puts a
 * matching `id` on the input. Counted across the codebase: 192 uses of `Field`,
 * and `htmlFor` passed on ZERO of them. So not one label in the product was
 * associated with its control.
 *
 * What that costs, concretely: clicking a label does nothing, which on a phone
 * means missing a 14px target instead of a 200px one; a screen reader announces
 * "edit text" with no indication of what it is for; and voice control has no
 * name to address the field by.
 *
 * The fix is to nest rather than reference. `<label>Name <input/></label>` is
 * associated by containment — no id, nothing for a caller to remember, and it
 * cannot fall out of sync. Checked before changing it: of 183 `Field` bodies,
 * 181 contain exactly one form control, so the "first labelable descendant" rule
 * picks the right one every time. The two that do not (a Combobox and a
 * conditional Select) contain no more than one control at a time either.
 *
 * `htmlFor` still works and still renders the sibling form, as an escape hatch
 * for a control that manages its own labelling or renders a nested `<label>` of
 * its own — nesting labels is invalid, so that case needs the old shape.
 */
export function Field({
  label, hint, error, htmlFor, required, children, className,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  /** Escape hatch: renders the label as a sibling instead of a wrapper. */
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const labelText = label && (
    <>
      {label}
      {/*
        A red asterisk is a convention, not a label. Screen readers announce it
        as "star" or skip it, and a colour-blind reader gets nothing at all — so
        the requirement was carried by colour alone, which is the one thing an
        indicator may never do. The visible mark stays for people who read it as
        a convention; the word is what is announced.
      */}
      {required && (
        <>
          <span aria-hidden className="ml-0.5 text-destructive">*</span>
          <span className="sr-only"> (required)</span>
        </>
      )}
    </>
  );

  const hintNode = hint && !error && (
    <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-[11px] text-muted-foreground">{hint}</p>
  );

  /*
    `role="alert"` so the message is announced when it appears rather than only
    being found by someone who happens to tab back over the field. An error that
    is only visible is an error that gets submitted twice.
  */
  const errorNode = error && (
    <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="text-[11px] font-medium text-destructive">
      {error}
    </p>
  );

  const labelCls = 'block text-xs font-medium text-muted-foreground';

  // Escape hatch: caller is managing the association itself.
  if (htmlFor) {
    return (
      <div className={cn('space-y-1', className)}>
        {label && <label htmlFor={htmlFor} className={labelCls}>{labelText}</label>}
        {children}
        {hintNode}
        {errorNode}
      </div>
    );
  }

  // No label text means there is nothing to associate — stay a plain div rather
  // than emit an empty <label>, which a screen reader would announce as a
  // labelled group containing nothing.
  if (!label) {
    return <div className={cn('space-y-1', className)}>{children}{hintNode}{errorNode}</div>;
  }

  return (
    <label className={cn('block space-y-1', className)}>
      <span className={labelCls}>{labelText}</span>
      {children}
      {hintNode}
      {errorNode}
    </label>
  );
}

/** A responsive grid for laying fields out — the pattern every add-form used. */
export function FormGrid({ cols = 3, children, className }: { cols?: 1 | 2 | 3; children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid gap-3', cols === 2 && 'sm:grid-cols-2', cols === 3 && 'sm:grid-cols-3', className)}>
      {children}
    </div>
  );
}

'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, X, ChevronRight, ChevronDown } from 'lucide-react';
import { StatTile, StatTileRow } from '@/components/ui/stat-tile';
import { Field, FormGrid } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChipRow, ChipLink } from '@/components/ui/chip';
import { cn } from '@/lib/utils/cn';

export interface RegisterColumn<R> {
  label: string;
  render: (row: R) => ReactNode;
  className?: string;
}
export interface RegisterField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'tel' | 'currency';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  defaultValue?: string;
  /** Tuck this field under "More details" — keeps the everyday form short. */
  advanced?: boolean;
}
export interface RegisterTile { label: string; value: string; sub?: string; tone?: 'default' | 'bad' | 'good' }

type Res = { ok: true; message: string; id?: string } | { error: string };

/**
 * A generic register: a filterable list plus an add form driven by config, so a
 * "raise a risk / log a decision / record a manifest" screen is a page of
 * configuration rather than a page of hand-written table and form markup. The
 * batch's typed server action is passed in as `onCreate`. This is Batch 1's
 * design-system principle applied to whole screens.
 */
export function RegisterScreen<R extends { id: string }>({
  basePath, projects, projectId, tiles, columns, rows, fields, onCreate, addLabel = 'Add', emptyText, canManage,
}: {
  basePath: string;
  projects?: Array<{ id: string; name: string }>;
  projectId?: string | null;
  tiles?: RegisterTile[];
  columns: RegisterColumn<R>[];
  rows: R[];
  fields: RegisterField[];
  onCreate: (values: Record<string, string>) => Promise<Res>;
  addLabel?: string;
  emptyText: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const baseFields = fields.filter((f) => !f.advanced);
  const advFields = fields.filter((f) => f.advanced);

  const renderField = (f: RegisterField) => (
    <Field key={f.name} label={f.label} required={f.required} hint={f.hint}>
      {f.type === 'select' ? (
        <Select name={f.name} defaultValue={f.defaultValue ?? f.options?.[0]?.value ?? ''}>
          {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      ) : f.type === 'textarea' ? (
        <textarea name={f.name} placeholder={f.placeholder} defaultValue={f.defaultValue} className="focus-ring mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" rows={2} />
      ) : f.type === 'tel' ? (
        <Input name={f.name} type="tel" inputMode="tel" autoComplete="tel" placeholder={f.placeholder ?? '10-digit mobile'} defaultValue={f.defaultValue} />
      ) : f.type === 'currency' ? (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
          <Input name={f.name} type="number" inputMode="decimal" step="any" min="0" placeholder={f.placeholder ?? '0'} defaultValue={f.defaultValue} className="pl-7" />
        </div>
      ) : (
        <Input name={f.name} type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} placeholder={f.placeholder} defaultValue={f.defaultValue} step={f.type === 'number' ? 'any' : undefined} />
      )}
    </Field>
  );

  return (
    <div className="space-y-4">
      {projects && projects.length > 1 && (
        <ChipRow>
          <ChipLink href={basePath} active={projectId == null}>All</ChipLink>
          {projects.map((p) => <ChipLink key={p.id} href={`${basePath}?project=${p.id}`} active={p.id === projectId}>{p.name}</ChipLink>)}
        </ChipRow>
      )}

      {tiles && tiles.length > 0 && (
        <StatTileRow cols={(Math.min(4, Math.max(3, tiles.length)) as 3 | 4)}>
          {tiles.map((t, i) => <StatTile key={i} label={t.label} value={t.value} sub={t.sub} tone={t.tone} />)}
        </StatTileRow>
      )}

      {canManage && (
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>{open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{open ? 'Close' : addLabel}</Button>
      )}
      {open && canManage && (
        <form
          className="rounded-lg border border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const values: Record<string, string> = {};
            for (const f of fields) values[f.name] = String(fd.get(f.name) ?? '').trim();

            // Friendly validation before we hit the server: name the first
            // empty required field in plain words instead of a browser popup.
            const missing = fields.find((f) => f.required && !values[f.name]);
            if (missing) {
              setMsg({ bad: true, text: `Please fill in “${missing.label}”.` });
              if (missing.advanced) setShowMore(true);
              const el = e.currentTarget.elements.namedItem(missing.name);
              if (el instanceof HTMLElement) el.focus();
              return;
            }
            setMsg(null);
            start(async () => {
              const r = await onCreate(values);
              setMsg('error' in r ? { bad: true, text: r.error } : { bad: false, text: r.message });
              if (!('error' in r)) { setOpen(false); setShowMore(false); router.refresh(); }
            });
          }}
        >
          <FormGrid cols={3}>
            {baseFields.map(renderField)}
          </FormGrid>

          {advFields.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                className="mt-3 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                aria-expanded={showMore}
              >
                {showMore ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {showMore ? 'Fewer details' : `More details (${advFields.length})`}
              </button>
              {/* Kept mounted (just hidden) so anything typed here is still
                  submitted even when the section is folded. */}
              <div className={cn('mt-3', !showMore && 'hidden')}>
                <FormGrid cols={3}>{advFields.map(renderField)}</FormGrid>
              </div>
            </>
          )}

          <div className="mt-3"><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save</Button></div>
        </form>
      )}
      {msg && <p className={cn('text-sm', msg.bad ? 'text-destructive' : 'text-emerald-600')}>{msg.text}</p>}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{emptyText}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground"><tr className="text-left">{columns.map((c, i) => <th key={i} className={cn('p-2', c.className)}>{c.label}</th>)}</tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  {columns.map((c, i) => <td key={i} className={cn('p-2', c.className)}>{c.render(row)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

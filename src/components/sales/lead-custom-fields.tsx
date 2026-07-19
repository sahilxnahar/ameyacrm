'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { setLeadCustomFields } from '@/server/actions/custom-fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Field { id: string; key: string; label: string; type: string; options: string[]; required: boolean }

export function LeadCustomFields({ leadId, fields, values }: { leadId: string; fields: Field[]; values: Record<string, unknown> }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [vals, setVals] = React.useState<Record<string, unknown>>(values ?? {});
  if (fields.length === 0) return null;
  const set = (k: string, v: unknown) => setVals((p) => ({ ...p, [k]: v }));
  const save = () => start(async () => { const r = await setLeadCustomFields(leadId, vals); if ('error' in r) return toast.error(r.error); toast.success('Saved'); router.refresh(); });

  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <div key={f.id} className="space-y-1">
          <Label htmlFor={f.key} className="text-xs">{f.label}{f.required && ' *'}</Label>
          {f.type === 'select' ? (
            <select id={f.key} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={String(vals[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)}>
              <option value="">—</option>{f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : f.type === 'checkbox' ? (
            <input id={f.key} type="checkbox" checked={Boolean(vals[f.key])} onChange={(e) => set(f.key, e.target.checked)} />
          ) : (
            <Input id={f.key} type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} value={String(vals[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)} />
          )}
        </div>
      ))}
      <Button size="sm" variant="outline" className="w-full" onClick={save} disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save fields</Button>
    </div>
  );
}

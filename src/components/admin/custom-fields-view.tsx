'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, Trash2 } from 'lucide-react';
import { createCustomField, toggleCustomField, deleteCustomField } from '@/server/actions/custom-fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

import { CUSTOM_FIELD_ENTITIES } from '@/config/customisation';

interface Field { id: string; entity: string; key: string; label: string; type: string; options: string[]; required: boolean; order: number; isActive: boolean }
const sel = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm';

export function CustomFieldsView({ fields }: { fields: Field[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [type, setType] = React.useState('text');

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form);
    start(async () => {
      const r = await createCustomField({ entity: fd.get('entity') || 'lead', key: fd.get('key'), label: fd.get('label'), type: fd.get('type'), options: fd.get('options') || undefined, required: fd.get('required') === 'on', order: fd.get('order') || 0 });
      if ('error' in r) return toast.error(r.error);
      toast.success('Field added'); form.reset(); setType('text'); router.refresh();
    });
  };
  const act = (fn: () => Promise<{ ok: true } | { error: string }>, msg: string) =>
    start(async () => { const r = await fn(); if ('error' in r) return toast.error(r.error); toast.success(msg); router.refresh(); });

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <p className="mb-3 text-sm font-semibold">Add a field to Leads</p>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor="label">Label</Label><Input id="label" name="label" placeholder="Possession preference" required /></div>
          <div className="space-y-1"><Label htmlFor="key">Key</Label><Input id="key" name="key" placeholder="possession_pref" required /></div>
          <div className="space-y-1"><Label htmlFor="type">Type</Label>
            <select id="type" name="type" className={sel} value={type} onChange={(e) => setType(e.target.value)}>
              {['text', 'number', 'date', 'select', 'checkbox'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select></div>
          <div className="space-y-1"><Label htmlFor="order">Order</Label><Input id="order" name="order" type="number" defaultValue={0} /></div>
          {type === 'select' && <div className="col-span-2 space-y-1"><Label htmlFor="options">Options (comma separated)</Label><Input id="options" name="options" placeholder="Ready to move, Under construction" /></div>}
          <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="required" /> Required</label>
          <div className="col-span-2 flex justify-end"><Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}<Plus className="h-4 w-4" /> Add field</Button></div>
        </form>
      </Card>

      <Card className="divide-y">
        {fields.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No custom fields yet.</p>}
        {fields.map((f) => (
          <div key={f.id} className="flex items-center justify-between p-3">
            <div>
              <p className="text-sm font-medium">{f.label} <span className="text-xs text-muted-foreground">· {f.key}</span></p>
              <p className="text-xs text-muted-foreground">{f.type}{f.options.length ? ` (${f.options.join(', ')})` : ''}{f.required ? ' · required' : ''}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={f.isActive ? 'success' : 'secondary'}>{f.isActive ? 'Active' : 'Hidden'}</Badge>
              <Switch checked={f.isActive} disabled={pending} onCheckedChange={(v) => act(() => toggleCustomField(f.id, v), 'Updated')} />
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={pending} onClick={() => act(() => deleteCustomField(f.id), 'Deleted')}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save, RotateCcw } from 'lucide-react';
import { saveTerms, saveStages, resetCustomisation } from '@/server/actions/customisation';
import { PIPELINE_KEYS, type Terminology, type StageConfig, type PipelineKey } from '@/config/customisation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

const PAIRS: Array<[keyof Terminology, keyof Terminology, string]> = [
  ['lead', 'leads', 'An enquiry'],
  ['unit', 'units', 'A flat or plot'],
  ['booking', 'bookings', 'A completed sale'],
  ['customer', 'customers', 'Someone who has bought'],
  ['project', 'projects', 'A development'],
];

export function CustomisationView({ terms, stages }: { terms: Terminology; stages: Record<PipelineKey, StageConfig> }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [t, setT] = React.useState(terms);
  const [s, setS] = React.useState(stages);

  const run = (fn: () => Promise<{ ok?: true } | { error: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if ('error' in r && r.error) return toast.error(r.error);
      toast.success(ok);
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">What you call things</p>
            <p className="text-sm text-muted-foreground">
              If your team says &ldquo;Enquiry&rdquo; rather than &ldquo;Lead&rdquo;, or &ldquo;Apartment&rdquo; rather than &ldquo;Unit&rdquo;, change it here.
            </p>
          </div>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => resetCustomisation('terms'), 'Back to the standard words')}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {PAIRS.map(([one, many, hint]) => (
            <div key={one} className="space-y-1.5">
              <Label htmlFor={one}>{hint}</Label>
              <div className="flex gap-2">
                <Input id={one} value={t[one]} onChange={(e) => setT({ ...t, [one]: e.target.value })} placeholder="Singular" />
                <Input value={t[many]} onChange={(e) => setT({ ...t, [many]: e.target.value })} placeholder="Plural" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <Button disabled={pending} onClick={() => run(() => saveTerms(t as unknown as Record<string, string>), 'Words saved')}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save words
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Pipeline stages</p>
            <p className="text-sm text-muted-foreground">
              Rename a stage, turn off one you do not use, and set how likely a deal at that stage is to close.
              The odds drive the weighted pipeline on the forecast.
            </p>
          </div>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => resetCustomisation('stages'), 'Stages reset')}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>

        <div className="mt-3 space-y-2">
          {PIPELINE_KEYS.map((k) => {
            const locked = k === 'NEW' || k === 'WON' || k === 'LOST';
            return (
              <div key={k} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                <span className="w-24 shrink-0 font-mono text-[10px] uppercase text-muted-foreground">{k}</span>
                <Input className="h-8 min-w-32 flex-1" value={s[k].label}
                  onChange={(e) => setS({ ...s, [k]: { ...s[k], label: e.target.value } })} />
                <span className="flex items-center gap-1.5">
                  <Input className="h-8 w-16" type="number" min={0} max={100} value={s[k].probability}
                    onChange={(e) => setS({ ...s, [k]: { ...s[k], probability: Number(e.target.value) } })} />
                  <span className="text-xs text-muted-foreground">% close</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Switch checked={s[k].active} disabled={locked}
                    onCheckedChange={(v) => setS({ ...s, [k]: { ...s[k], active: v } })} />
                  <span className="text-xs text-muted-foreground">{locked ? 'always on' : 'in use'}</span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-end">
          <Button disabled={pending} onClick={() => run(() => saveStages(s as unknown as Record<string, { label: string; probability: number; active: boolean }>), 'Stages saved')}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save stages
          </Button>
        </div>
      </Card>
    </div>
  );
}

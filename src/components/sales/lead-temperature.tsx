'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Flame, Thermometer, Snowflake } from 'lucide-react';
import { setLeadTemperature } from '@/server/actions/sales';
import { Button } from '@/components/ui/button';

const OPTS = [
  { key: 'HOT', label: 'Hot', Icon: Flame, on: 'bg-rose-500/15 border-rose-500/50 text-rose-700' },
  { key: 'WARM', label: 'Warm', Icon: Thermometer, on: 'bg-amber-500/15 border-amber-500/50 text-amber-700' },
  { key: 'COLD', label: 'Cold', Icon: Snowflake, on: 'bg-sky-500/15 border-sky-500/50 text-sky-700' },
] as const;

export function LeadTemperature({ leadId, value }: { leadId: string; value: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const set = (t: 'HOT' | 'WARM' | 'COLD') => start(async () => {
    const r = await setLeadTemperature(leadId, t);
    if ('error' in r) return toast.error(r.error);
    toast.success(`Marked ${t.toLowerCase()}`); router.refresh();
  });
  return (
    <div className="flex gap-1">
      {OPTS.map(({ key, label, Icon, on }) => (
        <Button key={key} size="sm" variant="outline" disabled={pending}
          className={`h-7 flex-1 text-xs ${value === key ? on : ''}`} onClick={() => set(key)}>
          <Icon className="h-3 w-3" /> {label}
        </Button>
      ))}
    </div>
  );
}

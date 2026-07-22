'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, X, Loader2, Radio, KeyRound, Copy, Activity } from 'lucide-react';
import { registerTelemetryDevice, rotateDeviceKey, recordManualReading } from '@/server/actions/telemetry';
import type { TelemetryOverview } from '@/server/services/telemetry-service';
import { statusLabel, metricLabel, formatReading, type DeviceStatus } from '@/lib/telemetry/status';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field, FormGrid } from '@/components/ui/field';
import { StatTile, StatTileRow } from '@/components/ui/stat-tile';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDateTime } from '@/lib/utils/format';

const STATUS_VARIANT: Record<DeviceStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  online: 'success', idle: 'warning', offline: 'destructive', never: 'secondary',
};

export function TelemetryView({ data, projects, canManage }: { data: TelemetryOverview; projects: Array<{ id: string; name: string }>; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [newKey, setNewKey] = React.useState<{ name: string; key: string } | null>(null);
  const [ingestUrl, setIngestUrl] = React.useState('/api/telemetry');

  React.useEffect(() => { setIngestUrl(`${window.location.origin}/api/telemetry`); }, []);

  const copy = (text: string) => { navigator.clipboard?.writeText(text).then(() => toast.success('Copied')).catch(() => {}); };

  const register = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = Object.fromEntries([...fd.entries()].map(([k, val]) => [k, String(val)])) as Record<string, string>;
    start(async () => {
      const r = await registerTelemetryDevice(v);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(r.message);
      if (r.deviceKey) setNewKey({ name: v.name ?? 'Device', key: r.deviceKey });
      setOpen(false); router.refresh();
    });
  };

  const rotate = (id: string) => start(async () => {
    const r = await rotateDeviceKey(id);
    if ('error' in r) { toast.error(r.error); return; }
    if (r.deviceKey) { setNewKey({ name: 'Device', key: r.deviceKey }); toast.success('Key rotated'); }
    router.refresh();
  });

  const testReading = (deviceId: string) => start(async () => {
    const metric = window.prompt('Metric (e.g. temperature)', 'temperature');
    if (!metric) return;
    const value = window.prompt(`Value for ${metric}`, '31.5');
    if (value == null) return;
    const r = await recordManualReading({ deviceId, metric, value, unit: '' });
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Reading recorded'); router.refresh();
  });

  return (
    <div className="space-y-5">
      <StatTileRow cols={3}>
        <StatTile label="Devices" value={String(data.counts.devices)} icon={<Radio className="h-3.5 w-3.5" />} />
        <StatTile label="Online now" value={String(data.counts.online)} tone={data.counts.online > 0 ? 'good' : 'default'} />
        <StatTile label="Readings" value={data.counts.readings.toLocaleString('en-IN')} icon={<Activity className="h-3.5 w-3.5" />} />
      </StatTileRow>

      {newKey && (
        <Card className="border-primary/40 bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold"><KeyRound className="h-4 w-4 text-[#A07D34]" /> Device key for {newKey.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">Copy it into the device now — it is shown once. Point the device at the ingestion URL below.</p>
              <code className="mt-2 block max-w-full truncate rounded bg-background px-2 py-1 font-mono text-xs">{newKey.key}</code>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="outline" onClick={() => copy(newKey.key)}><Copy className="h-3.5 w-3.5" /> Copy</Button>
              <button onClick={() => setNewKey(null)} aria-label="Dismiss" className="rounded p-1 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <p className="text-sm font-semibold">Connect a device</p>
        <p className="mt-1 text-xs text-muted-foreground">Any sensor, GPS tracker, fuel/power meter or drone can POST its readings here — no login, just its key.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="rounded bg-secondary px-2 py-1 font-mono text-xs">POST {ingestUrl}</code>
          <Button size="sm" variant="ghost" onClick={() => copy(`curl -X POST ${ingestUrl} -H 'Content-Type: application/json' -d '{"deviceKey":"<KEY>","readings":[{"metric":"temperature","value":31.5,"unit":"°C"}]}'`)}>Copy example</Button>
        </div>
      </Card>

      {canManage && (
        <div>
          <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>{open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{open ? 'Close' : 'Register a device'}</Button>
          {open && (
            <Card className="mt-3 p-4">
              <form onSubmit={register}>
                <FormGrid cols={2}>
                  <Field label="Device name" required><Input name="name" required placeholder="e.g. Tower crane GPS" /></Field>
                  <Field label="Kind"><Select name="kind" defaultValue="sensor">{['sensor', 'tracker', 'drone', 'meter'].map((k) => <option key={k} value={k}>{k}</option>)}</Select></Field>
                  <Field label="Project"><Select name="projectId" defaultValue=""><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
                  <Field label="Location"><Input name="location" placeholder="e.g. Block A, level 12" /></Field>
                </FormGrid>
                <div className="mt-3"><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Register</Button></div>
              </form>
            </Card>
          )}
        </div>
      )}

      {data.devices.length === 0 ? (
        <EmptyState icon={Radio} title="No devices yet" body="Register a sensor, tracker or meter to start seeing live readings from site." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.devices.map((d) => (
            <Card key={d.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.kind}{d.location ? ` · ${d.location}` : ''}</p>
                </div>
                <Badge variant={STATUS_VARIANT[d.status]}>{statusLabel(d.status)}</Badge>
              </div>
              {d.latest.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {d.latest.slice(0, 6).map((r) => (
                    <div key={r.metric} className="rounded-md border p-2">
                      <div className="text-[11px] text-muted-foreground">{metricLabel(r.metric)}</div>
                      <div className="font-display text-base font-semibold">{formatReading(r.value, r.unit)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">No readings yet.</p>
              )}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{d.lastSeenAt ? `Last seen ${formatDateTime(d.lastSeenAt)}` : 'Never reported'}</span>
                {canManage && (
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => testReading(d.id)} disabled={pending}>Test reading</Button>
                    <Button size="sm" variant="ghost" onClick={() => rotate(d.id)} disabled={pending}>Rotate key</Button>
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {data.recent.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 text-sm font-semibold">Latest readings</p>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {data.recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 border-b py-1 text-xs last:border-0">
                <span className="truncate">{r.deviceName} · {metricLabel(r.metric)}</span>
                <span className="shrink-0 font-medium">{formatReading(r.value, r.unit)}</span>
                <span className="shrink-0 text-muted-foreground">{formatDateTime(r.recordedAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

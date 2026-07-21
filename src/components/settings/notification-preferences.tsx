'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { saveNotificationPreference, saveNotificationSettings } from '@/server/actions/notifications';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PushSubscribe } from './push-subscribe';
import { titleCase } from '@/lib/utils/format';

const TYPES = ['TASK_ASSIGNED', 'TASK_UPDATED', 'COMMENT', 'MENTION', 'APPROVAL', 'DEADLINE', 'MEETING', 'DOCUMENT', 'MATERIAL_REQUEST', 'ANNOUNCEMENT', 'SYSTEM'];
const CHANNELS = ['IN_APP', 'EMAIL', 'PUSH'] as const;

export function NotificationPreferences({ prefs, settings }: {
  prefs: Record<string, boolean>;
  settings: { dnd: boolean; quietStart: string; quietEnd: string; sound: boolean; vibrate: boolean };
}) {
  const [pending, start] = React.useTransition();
  const [local, setLocal] = React.useState(prefs);
  const [dnd, setDnd] = React.useState(settings.dnd);
  const [sound, setSound] = React.useState(settings.sound);
  const [vibrate, setVibrate] = React.useState(settings.vibrate);

  const toggle = (type: string, channel: (typeof CHANNELS)[number], enabled: boolean) => {
    setLocal((p) => ({ ...p, [`${type}:${channel}`]: enabled }));
    start(async () => { const r = await saveNotificationPreference(type as never, channel as never, enabled); if ('error' in r) toast.error(r.error); });
  };
  const saveSettings = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    start(async () => { const r = await saveNotificationSettings({ dnd, quietStart: fd.get('quietStart'), quietEnd: fd.get('quietEnd'), sound, vibrate }); if ('error' in r) { toast.error(r.error); return; } toast.success('Preferences saved'); });
  };

  const on = (type: string, ch: string) => local[`${type}:${ch}`] ?? true;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-lg">Devices</CardTitle><CardDescription>Enable browser/PWA push on each device you use.</CardDescription></CardHeader>
        <CardContent><PushSubscribe /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Quiet hours &amp; alerts</CardTitle><CardDescription>In-app notifications always arrive; email & push respect these.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={saveSettings} className="space-y-4">
            <label className="flex items-center justify-between"><span className="text-sm font-medium">Do Not Disturb</span><Switch checked={dnd} onCheckedChange={setDnd} /></label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="quietStart">Quiet from</Label><Input id="quietStart" name="quietStart" type="time" defaultValue={settings.quietStart} /></div>
              <div className="space-y-2"><Label htmlFor="quietEnd">Quiet until</Label><Input id="quietEnd" name="quietEnd" type="time" defaultValue={settings.quietEnd} /></div>
            </div>
            <label className="flex items-center justify-between"><span className="text-sm font-medium">Sound</span><Switch checked={sound} onCheckedChange={setSound} /></label>
            <label className="flex items-center justify-between"><span className="text-sm font-medium">Vibration</span><Switch checked={vibrate} onCheckedChange={setVibrate} /></label>
            <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Categories</CardTitle><CardDescription>Choose how you’re notified per event type.</CardDescription></CardHeader>
        <CardContent>
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-6 gap-y-3 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</span>
            {CHANNELS.map((c) => <span key={c} className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c === 'IN_APP' ? 'In-app' : titleCase(c)}</span>)}
            {TYPES.map((t) => (
              <React.Fragment key={t}>
                <span>{titleCase(t)}</span>
                {CHANNELS.map((c) => (
                  <div key={c} className="flex justify-center">
                    <Switch checked={on(t, c)} onCheckedChange={(v) => toggle(t, c, v)} />
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

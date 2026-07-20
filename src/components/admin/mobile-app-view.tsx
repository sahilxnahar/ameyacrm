'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save, Copy, MessageCircle, BellOff, Smartphone, AlertTriangle, Clock } from 'lucide-react';
import { saveApkUrl, snoozeOverdueNotice } from '@/server/actions/app-install';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface Notice {
  id: string; title: string; kind: string; userName: string; whatsappNumber: string | null;
  href: string | null; lateBy: string; pushCount: number; emailCount: number;
  hasPush: boolean; snoozedUntil: string | null;
}

export function MobileAppView({
  apkUrl, appUrl, notices, pushEnabled, totalPeople, whatsappConfigured,
}: {
  apkUrl: string; appUrl: string; notices: Notice[];
  pushEnabled: number; totalPeople: number; whatsappConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [url, setUrl] = React.useState(apkUrl);

  const run = (fn: () => Promise<{ ok?: true; message?: string } | { error: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if ('error' in r && r.error) return toast.error(r.error);
      toast.success(('message' in r && r.message) || ok);
      router.refresh();
    });

  const waLink = (n: Notice) =>
    `https://wa.me/${n.whatsappNumber}?text=${encodeURIComponent(`Reminder: "${n.title}" was due ${n.lateBy} ago. Open: ${appUrl}${n.href ?? '/today'}`)}`;

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-semibold"><Smartphone className="h-4 w-4" /> Android app download</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a link to your .apk and it appears on the sign-in page and at <code className="text-xs">{appUrl}/install</code>.
          Leave it empty and staff are shown the browser install method instead, which works just as well.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-64 flex-1 space-y-1.5">
            <Label htmlFor="apk">Link to the .apk file</Label>
            <Input id="apk" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/ameya-crm.apk" />
          </div>
          <Button disabled={pending} onClick={() => run(() => saveApkUrl(url), 'Saved')}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </Button>
          <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(`${appUrl}/install`); toast.success('Link copied — send it to the team'); }}>
            <Copy className="h-4 w-4" /> Copy install link
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Phones receiving push</p>
          <p className="font-display text-2xl font-semibold">{pushEnabled} <span className="text-base font-normal text-muted-foreground">of {totalPeople}</span></p>
          {pushEnabled < totalPeople && <p className="text-[11px] text-warning">The rest will not get hourly reminders until they install and allow notifications.</p>}
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Currently overdue</p>
          <p className="font-display text-2xl font-semibold">{notices.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">WhatsApp sending</p>
          <p className="font-display text-2xl font-semibold">{whatsappConfigured ? 'On' : 'Manual'}</p>
          {!whatsappConfigured && <p className="text-[11px] text-muted-foreground">No gateway set — use the one-tap buttons below.</p>}
        </Card>
      </div>

      {!whatsappConfigured && (
        <Card className="flex items-start gap-2 border-warning/40 bg-warning/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            Automatic WhatsApp needs a gateway account — personal WhatsApp has no API of any kind.
            Push and email reminders run automatically regardless. Set <code className="text-xs">WHATSAPP_WEBHOOK_URL</code> in
            Vercel once you have a provider and the WhatsApp leg starts by itself.
          </span>
        </Card>
      )}

      <Card className="table-scroll">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-3">Work</th><th className="p-3">Owner</th><th className="p-3">Late by</th><th className="p-3 text-right">Nudges</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {notices.map((n) => (
              <tr key={n.id} className="border-b last:border-0">
                <td className="p-3">
                  <span className="font-medium">{n.title}</span>
                  <span className="mt-0.5 block"><Badge variant="secondary" className="text-[10px]">{n.kind}</Badge></span>
                </td>
                <td className="p-3">
                  {n.userName}
                  {!n.hasPush && <span className="block text-[11px] text-warning">no phone registered</span>}
                </td>
                <td className="p-3 text-destructive">{n.lateBy}</td>
                <td className="p-3 text-right text-xs text-muted-foreground">{n.pushCount} push · {n.emailCount} email</td>
                <td className="p-3 text-right">
                  <span className="flex flex-wrap justify-end gap-1.5">
                    {n.whatsappNumber && (
                      <a href={waLink(n)} target="_blank" rel="noreferrer"
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs" title="Send this reminder on WhatsApp now">
                        <MessageCircle className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp
                      </a>
                    )}
                    {n.snoozedUntil && new Date(n.snoozedUntil) > new Date() ? (
                      <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> quiet</Badge>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2 text-xs" disabled={pending}
                        title="Stop reminding them about this for 24 hours"
                        onClick={() => run(() => snoozeOverdueNotice(n.id, 24), 'Snoozed')}>
                        <BellOff className="h-3.5 w-3.5" /> Snooze 24h
                      </Button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
            {notices.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nothing overdue. Nobody is being chased.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

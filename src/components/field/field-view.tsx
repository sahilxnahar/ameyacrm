'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format, addDays, startOfDay } from 'date-fns';
import { Loader2, LogIn, LogOut, MapPin, WifiOff, CloudUpload, CalendarDays, CheckCircle2 } from 'lucide-react';
import { punch, syncOfflinePunches, setRoster, clearRoster } from '@/server/actions/field-ops';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

const QUEUE_KEY = 'ameya.offlinePunches';
const SHIFTS = ['MORNING', 'EVENING', 'NIGHT', 'FULL_DAY', 'OFF'] as const;
const SHIFT_LABEL: Record<string, string> = { MORNING: 'Morning', EVENING: 'Evening', NIGHT: 'Night', FULL_DAY: 'Full day', OFF: 'Off' };

interface Punch { id: string; kind: string; at: string; withinSite: boolean; distanceM: number | null; offline: boolean }
interface TeamPunch extends Punch { userName: string }
interface Roster { id: string; userId: string; userName: string; date: string; shift: string; note: string | null }

export function FieldView({
  meId, isAdmin, projects, myToday, teamToday, users, roster,
}: {
  meId: string; isAdmin: boolean;
  projects: { id: string; name: string; hasCoords: boolean }[];
  myToday: Punch[]; teamToday: TeamPunch[];
  users: { id: string; name: string }[];
  roster: Roster[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [projectId, setProjectId] = React.useState(projects[0]?.id ?? '');
  const [locating, setLocating] = React.useState(false);
  const [queued, setQueued] = React.useState<number>(0);
  const [online, setOnline] = React.useState(true);
  const [tab, setTab] = React.useState<'me' | 'team' | 'roster'>('me');

  const readQueue = (): unknown[] => {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]'); } catch { return []; }
  };
  const writeQueue = (q: unknown[]) => { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); setQueued(q.length); };

  React.useEffect(() => {
    setQueued(readQueue().length);
    setOnline(navigator.onLine);
    const on = () => { setOnline(true); void flush(); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = async () => {
    const q = readQueue();
    if (!q.length) return;
    const r = await syncOfflinePunches(q);
    if ('ok' in r) { writeQueue([]); toast.success(r.message ?? 'Synced'); router.refresh(); }
  };

  const getPosition = () =>
    new Promise<GeolocationPosition | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (p) => { setLocating(false); resolve(p); },
        () => { setLocating(false); resolve(null); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
      );
    });

  const doPunch = async (kind: 'CHECK_IN' | 'CHECK_OUT') => {
    const pos = await getPosition();
    const payload = {
      kind, projectId: projectId || null,
      latitude: pos?.coords.latitude ?? null,
      longitude: pos?.coords.longitude ?? null,
      accuracyM: pos?.coords.accuracy ?? null,
      at: new Date().toISOString(),
    };

    if (!navigator.onLine) {
      writeQueue([...readQueue(), payload]);
      toast.success('Saved on this phone. It will upload by itself when you have signal.');
      return;
    }

    start(async () => {
      const r = await punch(payload);
      if ('error' in r) {
        writeQueue([...readQueue(), payload]);
        return toast.error(`${r.error} — saved on this phone for later.`);
      }
      toast.success(r.message ?? 'Recorded');
      router.refresh();
    });
  };

  const lastKind = myToday[0]?.kind;
  const days = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i));
  const rosterFor = (userId: string, d: Date) => roster.find((r) => r.userId === userId && format(new Date(r.date), 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd'));

  return (
    <div className="space-y-4">
      {!online && (
        <Card className="flex items-center gap-2 border-warning/40 bg-warning/5 p-3 text-sm">
          <WifiOff className="h-4 w-4 text-warning" />
          <span>No signal. Anything you record is kept on this phone and uploaded automatically once you are back online.</span>
        </Card>
      )}
      {queued > 0 && (
        <Card className="flex flex-wrap items-center gap-2 p-3 text-sm">
          <CloudUpload className="h-4 w-4" />
          <span><strong>{queued}</strong> {queued === 1 ? 'entry' : 'entries'} waiting to upload.</span>
          <Button size="sm" variant="outline" className="ml-auto" disabled={!online} onClick={() => void flush()}>Upload now</Button>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="site" className="text-xs font-medium">Site</label>
            <select id="site" className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Not at a site</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.hasCoords ? '' : ' (no location set)'}</option>)}
            </select>
          </div>
          <Button className="h-12 flex-1 sm:flex-none" disabled={pending || locating || lastKind === 'CHECK_IN'}
            onClick={() => void doPunch('CHECK_IN')}>
            {pending || locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Check in
          </Button>
          <Button variant="outline" className="h-12 flex-1 sm:flex-none" disabled={pending || locating || !lastKind || lastKind === 'CHECK_OUT'}
            onClick={() => void doPunch('CHECK_OUT')}>
            {pending || locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Check out
          </Button>
        </div>
        {locating && <p className="mt-2 text-xs text-muted-foreground">Finding your location — this takes a moment.</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          Your location is recorded only at the moment you tap. Nobody is tracked between check-in and check-out.
        </p>
      </Card>

      <div className="chip-row">
        <Button size="sm" variant={tab === 'me' ? 'default' : 'outline'} onClick={() => setTab('me')}>My day</Button>
        {isAdmin && <Button size="sm" variant={tab === 'team' ? 'default' : 'outline'} onClick={() => setTab('team')}>Everyone today</Button>}
        <Button size="sm" variant={tab === 'roster' ? 'default' : 'outline'} onClick={() => setTab('roster')}>
          <CalendarDays className="h-4 w-4" /> Duty roster
        </Button>
      </div>

      {tab === 'me' && (
        <Card className="p-3">
          {myToday.length === 0
            ? <p className="py-8 text-center text-sm text-muted-foreground">Nothing recorded today.</p>
            : <ul className="divide-y">{myToday.map((p) => <PunchRow key={p.id} p={p} />)}</ul>}
        </Card>
      )}

      {tab === 'team' && isAdmin && (
        <Card className="p-3">
          {teamToday.length === 0
            ? <p className="py-8 text-center text-sm text-muted-foreground">Nobody has checked in today.</p>
            : <ul className="divide-y">{teamToday.map((p) => <PunchRow key={p.id} p={p} who={p.userName} />)}</ul>}
        </Card>
      )}

      {tab === 'roster' && (
        <Card className="table-scroll">
          <table className="w-full text-xs">
            <thead className="border-b text-left uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-2">Person</th>
                {days.map((d) => (
                  <th key={d.toISOString()} className={cn('p-2 text-center', format(d, 'i') === '7' && 'text-destructive')}>
                    {format(d, 'EEE')}<br />{format(d, 'd')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(isAdmin ? users : [{ id: meId, name: 'You' }]).map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap p-2 font-medium">{u.name}</td>
                  {days.map((d) => {
                    const r = rosterFor(u.id, d);
                    return (
                      <td key={d.toISOString()} className="p-1 text-center">
                        {isAdmin ? (
                          <select
                            className="h-7 w-full rounded border border-input bg-background text-[10px]"
                            value={r?.shift ?? ''}
                            disabled={pending}
                            onChange={(e) => start(async () => {
                              const v = e.target.value;
                              const res = v
                                ? await setRoster({ userId: u.id, date: d.toISOString(), shift: v })
                                : await clearRoster(u.id, d.toISOString());
                              if ('error' in res) return toast.error(res.error);
                              router.refresh();
                            })}
                          >
                            <option value="">—</option>
                            {SHIFTS.map((s) => <option key={s} value={s}>{SHIFT_LABEL[s]}</option>)}
                          </select>
                        ) : (
                          <span className={cn('text-[10px]', r?.shift === 'OFF' && 'text-muted-foreground')}>{r ? SHIFT_LABEL[r.shift] : '—'}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function PunchRow({ p, who }: { p: Punch; who?: string }) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
      {p.kind === 'CHECK_IN' ? <LogIn className="h-3.5 w-3.5 text-success" /> : <LogOut className="h-3.5 w-3.5 text-muted-foreground" />}
      {who && <span className="font-medium">{who}</span>}
      <span>{p.kind === 'CHECK_IN' ? 'in' : 'out'} at {format(new Date(p.at), 'HH:mm')}</span>
      {p.withinSite
        ? <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> at site</Badge>
        : p.distanceM !== null
          ? <Badge variant="warning" className="gap-1"><MapPin className="h-3 w-3" /> {p.distanceM >= 1000 ? `${(p.distanceM / 1000).toFixed(1)} km away` : `${p.distanceM} m away`}</Badge>
          : <Badge variant="secondary">no location</Badge>}
      {p.offline && <Badge variant="secondary" className="gap-1"><WifiOff className="h-3 w-3" /> synced later</Badge>}
    </li>
  );
}

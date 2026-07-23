'use client';
import * as React from 'react';
import Link from 'next/link';
import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, Droplets, Gauge, MapPin, Loader2, CalendarClock, ArrowRight, ListChecks, BookOpen, Sparkles, QrCode, MessageSquare, LayoutDashboard, BellRing, CalendarDays, Megaphone, UserPlus, CheckSquare, Inbox, IndianRupee, HardHat, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AgendaItem { id: string; title: string; kind: string; due: string; href: string }
interface Kpi { leadsToday: number; tasksToday: number; approvals: number; collectionsDue: number; followUps: number; onSite: number }

function compactInr(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${n}`;
}

// WMO weather codes → a friendly label + icon.
function weather(code: number): { label: string; Icon: typeof Sun } {
  if (code === 0) return { label: 'Clear', Icon: Sun };
  if (code <= 2) return { label: 'Partly cloudy', Icon: Cloud };
  if (code === 3) return { label: 'Overcast', Icon: Cloud };
  if (code >= 45 && code <= 48) return { label: 'Fog', Icon: CloudFog };
  if (code >= 51 && code <= 67) return { label: 'Rain', Icon: CloudRain };
  if (code >= 71 && code <= 77) return { label: 'Snow', Icon: CloudSnow };
  if (code >= 80 && code <= 82) return { label: 'Showers', Icon: CloudRain };
  if (code >= 95) return { label: 'Thunderstorm', Icon: CloudLightning };
  return { label: 'Cloudy', Icon: Cloud };
}

const KIND_LABEL: Record<string, string> = { TASK: 'Task', REMINDER: 'Reminder', APPROVAL: 'Approval', COLLECTION: 'Collection', EVENT: 'Event' };

interface QuickAction { href: string; label: string; sub: string; icon: LucideIcon }
const QUICK_ACTIONS: QuickAction[] = [
  { href: '/today', label: "Today's Priorities", sub: 'Everything due today', icon: ListChecks },
  { href: '/tally', label: 'Ameya Tally', sub: 'Keyboard accounting', icon: BookOpen },
  { href: '/assistant', label: 'Assistant', sub: 'Draft & summarise', icon: Sparkles },
  { href: '/scan', label: 'Scan', sub: 'QR / barcode', icon: QrCode },
  { href: '/chat', label: 'Messages', sub: 'Chat the team', icon: MessageSquare },
  { href: '/dashboard', label: 'Dashboard', sub: 'Your numbers', icon: LayoutDashboard },
  { href: '/reminders', label: 'Reminders', sub: 'Your nudges', icon: BellRing },
  { href: '/calendar', label: 'Calendar', sub: 'Meetings & visits', icon: CalendarDays },
];
const JUMP_LINKS = [
  { href: '/marketing/library', label: 'Marketing Library' },
  { href: '/parking', label: 'Parking Matrix' },
  { href: '/litigation', label: 'Litigation & Renewals' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/notifications', label: 'Notifications' },
];

export function WelcomeHome({ firstName, agenda, next7 = [], kpi }: { firstName: string; agenda: AgendaItem[]; next7?: AgendaItem[]; kpi?: Kpi }) {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const [wx, setWx] = React.useState<{ temp: number; code: number; precip: number; uv: number; city: string } | null>(null);
  const [wxState, setWxState] = React.useState<'idle' | 'loading' | 'denied' | 'error'>('idle');

  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setWxState('error'); return; }
    setWxState('loading');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const wr = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,precipitation,weather_code,uv_index&timezone=auto`);
          const wj = await wr.json();
          let city = '';
          try {
            const gr = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
            const gj = await gr.json();
            city = gj.city || gj.locality || gj.principalSubdivision || '';
          } catch { /* city is a bonus */ }
          const c = wj.current ?? {};
          setWx({ temp: Math.round(c.temperature_2m ?? 0), code: c.weather_code ?? 3, precip: c.precipitation ?? 0, uv: Math.round(c.uv_index ?? 0), city });
          setWxState('idle');
        } catch { setWxState('error'); }
      },
      () => setWxState('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }, []);

  const hour = now?.getHours() ?? 9;
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now?.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) ?? '';
  const timeStr = now?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) ?? '';
  const W = wx ? weather(wx.code) : null;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-[#A07D34]/12 via-card to-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="gold-shine font-display text-3xl font-semibold leading-tight sm:text-4xl">{greeting}, {firstName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{dateStr}{timeStr && ` · ${timeStr}`}</p>
          </div>
          {/* Weather */}
          <div className="min-w-[190px]">
            {wxState === 'loading' && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Getting your weather…</p>}
            {wxState === 'denied' && <p className="max-w-[220px] text-xs text-muted-foreground">Allow location access to see your local weather here.</p>}
            {wxState === 'error' && <p className="max-w-[220px] text-xs text-muted-foreground">Weather isn’t available right now.</p>}
            {wx && W && (
              <div className="rounded-xl border bg-card/70 p-3">
                <div className="flex items-center gap-3">
                  <W.Icon className="h-9 w-9 text-[#A07D34]" />
                  <div>
                    <p className="text-2xl font-semibold leading-none tabular-nums">{wx.temp}°C</p>
                    <p className="text-xs text-muted-foreground">{W.label}</p>
                  </div>
                </div>
                {wx.city && <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {wx.city}</p>}
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Droplets className="h-3 w-3" /> {wx.precip} mm</span>
                  <span className="flex items-center gap-1"><Gauge className="h-3 w-3" /> UV {wx.uv}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live KPI tiles — your morning cockpit. */}
      {kpi && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="New leads today" value={String(kpi.leadsToday)} icon={UserPlus} href="/leads" />
          <StatTile label="Tasks due today" value={String(kpi.tasksToday)} icon={CheckSquare} href="/tasks" />
          <StatTile label="Approvals pending" value={String(kpi.approvals)} icon={Inbox} href="/approvals" />
          <StatTile label="Follow-ups (7d)" value={String(kpi.followUps)} icon={BellRing} href="/reminders" />
          <StatTile label="Collections due (7d)" value={compactInr(kpi.collectionsDue)} icon={IndianRupee} href="/billing" />
          <StatTile label="On site now" value={String(kpi.onSite)} icon={HardHat} href="/field" />
        </div>
      )}

      {/* Quick actions — jump straight into the work that matters most. */}
      <div>
        <p className="mb-2 text-sm font-semibold text-muted-foreground">Quick actions</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {QUICK_ACTIONS.map((q) => {
            const Icon = q.icon;
            return (
              <Link key={q.href} href={q.href} className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-[#A07D34]/50 hover:bg-[#A07D34]/5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#1B2A4A]/10 text-[#1B2A4A] transition-colors group-hover:bg-[#1B2A4A] group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{q.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{q.sub}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Agenda (wide) + jump-to shortcuts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <p className="mb-3 flex items-center gap-1.5 text-base font-semibold"><CalendarClock className="h-4 w-4 text-[#A07D34]" /> Today’s agenda</p>
          {agenda.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nothing due today — you’re all clear. 🎉</p>
          ) : (
            <ul className="divide-y">
              {agenda.map((a) => {
                const due = new Date(a.due);
                const time = due.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                return (
                  <li key={a.id}>
                    <Link href={a.href} className="flex items-center gap-3 py-3 hover:bg-secondary/40">
                      <Badge variant="secondary" className="shrink-0 text-[10px]">{KIND_LABEL[a.kind] ?? a.kind}</Badge>
                      <span className="min-w-0 flex-1 truncate text-sm">{a.title || '(untitled)'}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{time}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/today" className="text-xs font-medium text-primary hover:underline">See everything due →</Link>
            <Link href="/dashboard" className="ml-auto text-xs text-muted-foreground hover:text-foreground">Full dashboard →</Link>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-4 sm:p-5">
            <p className="mb-3 flex items-center gap-1.5 text-base font-semibold"><CalendarDays className="h-4 w-4 text-[#A07D34]" /> Next 7 days</p>
            {next7.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Nothing scheduled in the week ahead.</p>
            ) : (
              <ul className="divide-y">
                {next7.map((a) => {
                  const d = new Date(a.due);
                  const when = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
                  return (
                    <li key={a.id}>
                      <Link href={a.href} className="flex items-center gap-2 py-2 hover:bg-secondary/40">
                        <span className="min-w-0 flex-1 truncate text-sm">{a.title || '(untitled)'}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{when}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <p className="mb-3 flex items-center gap-1.5 text-base font-semibold"><Megaphone className="h-4 w-4 text-[#A07D34]" /> Jump to</p>
            <ul className="space-y-1">
              {JUMP_LINKS.map((j) => (
                <li key={j.href}>
                  <Link href={j.href} className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-secondary/50">
                    <span>{j.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-lg bg-[#A07D34]/8 p-3 text-xs text-muted-foreground">Tip: press <kbd className="rounded border bg-background px-1">⌘K</kbd> anywhere to search and jump to any screen, or drag your menu into the order you like from <span className="font-medium">Customise this menu</span>.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, icon: Icon, href }: { label: string; value: string; icon: LucideIcon; href: string }) {
  return (
    <Link href={href} className="group rounded-xl border bg-card p-3 transition-colors hover:border-[#A07D34]/50 hover:bg-[#A07D34]/5">
      <div className="mb-1 flex items-center justify-between">
        <Icon className="h-4 w-4 text-[#A07D34]" />
        <ArrowRight className="h-3 w-3 text-transparent transition-colors group-hover:text-muted-foreground" />
      </div>
      <p className="text-xl font-semibold tabular-nums text-[#1B2A4A] dark:text-foreground">{value}</p>
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
    </Link>
  );
}

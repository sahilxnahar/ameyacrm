'use client';
import * as React from 'react';
import Link from 'next/link';
import {
  Wallet, HardHat, Scale, Users2, UserRound, Package, ClipboardCheck, Settings, Search,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { LaunchpadBadges } from '@/server/services/command-center-service';

/**
 * The Ameya OS Launchpad — the Core 8 app grid. Real-time client-side filtering,
 * a 2-col grid that widens to 4 on lg, and an iOS App-Library single-column list
 * under sm. Every card is a ≥44px touch target with a macOS-style focus ring and
 * a live notification badge fed by the command-center badge service.
 */
interface AppDef {
  id: keyof LaunchpadBadges;
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  accent: string;   // icon tint
  keywords: string; // extra search terms
}

const CORE_APPS: AppDef[] = [
  { id: 'finance', title: 'Finance & Tax', subtitle: 'GST · MSME · TDS · vouchers', href: '/finance', icon: Wallet, accent: 'text-emerald-500', keywords: 'gst msme gstr tds money finance tax revenue' },
  { id: 'siteops', title: 'Site Ops & 4D BIM', subtitle: 'Daily progress · certifications', href: '/site-ops', icon: HardHat, accent: 'text-amber-500', keywords: 'bim site construction structural certifier ra bill slab daily log diary weather labour photos' },
  { id: 'legal', title: 'Legal & Due Diligence', subtitle: 'RERA · land records · litigation', href: '/due-diligence', icon: Scale, accent: 'text-violet-500', keywords: 'legal rera due diligence land record ip trademark litigation vault' },
  { id: 'vendor', title: 'Vendor & Labour', subtitle: 'BOCW · piece-rate · UAN', href: '/vendor-registry', icon: Users2, accent: 'text-blue-500', keywords: 'vendor labour bocw welfare uan piece rate sub-contractor' },
  { id: 'sales', title: 'Sales & CRM', subtitle: 'Leads · bookings · allocations', href: '/sales', icon: UserRound, accent: 'text-rose-500', keywords: 'sales crm leads bookings customers allocations demands' },
  { id: 'procurement', title: 'Procurement & Inventory', subtitle: 'Material gates · stock', href: '/billing', icon: Package, accent: 'text-orange-500', keywords: 'procurement inventory material indent stock purchase order gate' },
  { id: 'approvals', title: 'Corporate Approvals', subtitle: 'Pending sign-offs', href: '/approvals', icon: ClipboardCheck, accent: 'text-teal-500', keywords: 'approvals sign-off workflow authorize' },
  { id: 'settings', title: 'System Settings', subtitle: 'Admin · integrations · users', href: '/admin', icon: Settings, accent: 'text-slate-500', keywords: 'settings admin system users integrations config' },
];

export function Launchpad({ badges }: { badges: LaunchpadBadges }) {
  const [q, setQ] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const term = q.trim().toLowerCase();
  const apps = React.useMemo(
    () => (!term ? CORE_APPS : CORE_APPS.filter((a) => [a.title, a.subtitle, a.keywords].join(' ').toLowerCase().includes(term))),
    [term],
  );

  // "/" focuses the filter, like a native launcher.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault(); inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div data-keyboard-owner="launchpad" className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search apps…  (press /)"
          className="focus-ring h-11 w-full rounded-xl border bg-secondary/40 pl-9 pr-3 text-sm outline-none transition-colors focus:bg-background"
          aria-label="Search apps"
        />
      </div>

      <div className="stat-grid">
        {apps.map((app) => (
          <AppCard key={app.id} app={app} count={badges[app.id] ?? 0} />
        ))}
      </div>

      {apps.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No apps match “{q}”.</p> : null}
    </div>
  );
}

function AppCard({ app, count }: { app: AppDef; count: number }) {
  const Icon = app.icon;
  return (
    <Link
      href={app.href}
      className={cn(
        'group focus-ring relative flex min-h-[7rem] flex-col justify-between overflow-hidden rounded-2xl border bg-card p-4',
        'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg',
        'sm:min-h-[8.5rem]',
      )}
    >
      <div className="flex items-start justify-between">
        <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl bg-muted/60 transition-colors group-hover:bg-muted', app.accent)}>
          <Icon className="h-5 w-5" />
        </span>
        {count > 0 ? (
          <span className="min-w-[1.5rem] rounded-full bg-destructive px-1.5 py-0.5 text-center text-xs font-bold text-destructive-foreground">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        <div className="text-sm font-semibold leading-tight">{app.title}</div>
        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{app.subtitle}</div>
      </div>
    </Link>
  );
}

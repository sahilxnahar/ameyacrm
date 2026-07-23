'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, MapPin, Building2, Crosshair } from 'lucide-react';
import { geocodeProjects, geocodeLeads } from '@/server/actions/geo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface P { id: string; name: string; city: string; address: string | null; lat: number | null; lng: number | null }
interface L { id: string; name: string; reference: string; lat: number; lng: number; status: string; temperature: string; locality: string | null }

import 'maplibre-gl/dist/maplibre-gl.css';

const HEAT: Record<string, string> = { HOT: '#DC2626', WARM: '#D97706', COLD: '#2563EB' };

export function MapView({
  projects, leads, localities, canManage,
}: {
  projects: P[]; leads: L[];
  localities: { locality: string; count: number }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const ref = React.useRef<HTMLDivElement>(null);
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const pinned = projects.filter((p) => p.lat !== null && p.lng !== null);

  React.useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    // MapLibre is bundled with the app (npm dependency), not fetched from a
    // CDN — so it can never be blocked by a firewall, ad-blocker or CSP. We
    // still import it lazily so the ~200 KB library only loads on this page.
    import('maplibre-gl')
      .then((mod) => {
        if (cancelled || !ref.current) return;
        const maplibregl = (mod as { default?: any }).default ?? mod;
        const centre = pinned[0] ?? { lat: 12.9716, lng: 77.5946 };   // Bengaluru
        const map = new maplibregl.Map({
          container: ref.current,
          style: {
            version: 8,
            sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' } },
            layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
          },
          center: [centre.lng as number, centre.lat as number],
          zoom: 11,
        });
        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        for (const p of pinned) {
          const el = document.createElement('div');
          el.style.cssText = 'width:16px;height:16px;border-radius:3px;background:#A07D34;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)';
          new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat])
            .setPopup(new maplibregl.Popup({ offset: 14 }).setHTML(`<strong>${p.name}</strong><br/><span style="font-size:11px">${p.address ?? p.city}</span>`))
            .addTo(map);
        }
        for (const l of leads) {
          const el = document.createElement('div');
          el.style.cssText = `width:10px;height:10px;border-radius:50%;background:${HEAT[l.temperature] ?? '#2563EB'};opacity:.75;border:1px solid #fff`;
          new maplibregl.Marker({ element: el }).setLngLat([l.lng, l.lat])
            .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(`<strong>${l.name}</strong><br/><span style="font-size:11px">${l.reference} · ${l.status}${l.locality ? ` · ${l.locality}` : ''}</span>`))
            .addTo(map);
        }
        setReady(true);
        cleanup = () => map.remove();
      })
      .catch(() => !cancelled && setFailed(true));

    return () => { cancelled = true; cleanup?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = (fn: () => Promise<{ ok?: true; found?: number } | { error: string }>, what: string) =>
    start(async () => {
      const r = await fn();
      if ('error' in r && r.error) { toast.error(r.error); return; }
      toast.success(`${'found' in r ? r.found ?? 0 : 0} ${what} placed on the map`);
      router.refresh();
    });

  const maxLoc = Math.max(1, ...localities.map((l) => l.count));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1"><Building2 className="h-3 w-3" /> {pinned.length} of {projects.length} projects pinned</Badge>
        <Badge variant="secondary" className="gap-1"><MapPin className="h-3 w-3" /> {leads.length} leads placed</Badge>
        {canManage && (
          <Button size="sm" variant="outline" disabled={pending} title="Look up coordinates for projects that have an address but no pin"
            onClick={() => run(geocodeProjects, 'projects')}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />} Locate projects
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={pending} title="Look up coordinates for leads that have a locality but no pin"
          onClick={() => run(geocodeLeads, 'leads')}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />} Locate leads
        </Button>
        <span className="ml-auto flex items-center gap-3 text-xs">
          {Object.entries(HEAT).map(([k, c]) => (
            <span key={k} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} /> {k.toLowerCase()}</span>
          ))}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <Card className="overflow-hidden">
          <div ref={ref} className="h-[560px] w-full bg-secondary" />
          {!ready && !failed && <p className="p-3 text-center text-sm text-muted-foreground">Loading the map…</p>}
          {failed && <p className="p-3 text-center text-sm text-destructive">The map library could not load. Check your connection and reload.</p>}
        </Card>

        <Card className="p-3">
          <p className="mb-2 text-sm font-semibold">Enquiries by locality</p>
          {localities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No localities recorded yet. Add one on a lead and it will show here.</p>
          ) : (
            <ul className="space-y-1.5">
              {localities.map((l) => (
                <li key={l.locality} className="text-xs">
                  <span className="flex justify-between"><span>{l.locality}</span><span className="text-muted-foreground">{l.count}</span></span>
                  <span className="mt-0.5 block h-1.5 rounded bg-secondary">
                    <span className="block h-full rounded bg-primary" style={{ width: `${(l.count / maxLoc) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

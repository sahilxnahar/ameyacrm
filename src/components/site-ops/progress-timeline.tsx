import * as React from 'react';
import { CloudSun, Users, CalendarDays, Building2, User as UserIcon, Camera } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

export interface TimelinePhoto { id: string; url: string; milestoneTag: string }
export interface TimelineLog {
  id: string;
  date: string;        // ISO
  weather: string;
  laborCount: number;
  notes: string | null;
  projectName: string;
  authorName: string | null;
  photos: TimelinePhoto[];
}

function dayKey(iso: string): string { return iso.slice(0, 10); }
function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

const TAG_TONE: Record<string, string> = {
  Foundation: 'bg-amber-500/15 text-amber-600',
  MEP: 'bg-blue-500/15 text-blue-600',
  Brickwork: 'bg-orange-500/15 text-orange-600',
  Plastering: 'bg-violet-500/15 text-violet-600',
  Finishing: 'bg-emerald-500/15 text-emerald-600',
  Handover: 'bg-teal-500/15 text-teal-600',
};

/**
 * The 4D BIM chronological view: site logs newest-first, grouped by day. Photos
 * flow as a single-column feed on phones (thumb-scroll site review) and a CSS
 * masonry on wider screens, alongside the day's labour/weather stats.
 */
export function ProgressTimeline({ logs }: { logs: TimelineLog[] }) {
  if (!logs.length) {
    return (
      <EmptyState
        icon={Camera}
        title="No site logs yet"
        body="Tap “New site log” to record today’s weather, labour count and progress photos. Entries appear here as a running timeline."
      />
    );
  }

  // Group by calendar day, preserving the incoming newest-first order.
  const groups: { day: string; logs: TimelineLog[] }[] = [];
  const index = new Map<string, { day: string; logs: TimelineLog[] }>();
  for (const log of logs) {
    const k = dayKey(log.date);
    let group = index.get(k);
    if (!group) { group = { day: k, logs: [] }; index.set(k, group); groups.push(group); }
    group.logs.push(log);
  }

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.day} className="space-y-3">
          <div className="sticky top-14 z-[1] -mx-1 flex items-center gap-2 bg-background/85 px-1 py-1 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">{fmtDay(g.day)}</h2>
          </div>

          {g.logs.map((log) => (
            <article key={log.id} className="overflow-hidden rounded-xl border bg-card">
              <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-3">
                <span className="inline-flex items-center gap-1 text-sm font-medium"><Building2 className="h-4 w-4 text-muted-foreground" /> {log.projectName}</span>
                <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" /> {log.laborCount} on site</Badge>
                <Badge variant="secondary" className="gap-1"><CloudSun className="h-3 w-3" /> {log.weather}</Badge>
                {log.authorName ? <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground"><UserIcon className="h-3 w-3" /> {log.authorName}</span> : null}
              </header>

              {log.notes ? <p className="whitespace-pre-wrap px-4 pt-3 text-sm text-muted-foreground">{log.notes}</p> : null}

              {log.photos.length > 0 ? (
                <div className="p-3">
                  {/* Single column on phones (feed), masonry on wider screens. */}
                  <div className="columns-1 gap-2 sm:columns-2 lg:columns-3 [&>*]:mb-2">
                    {log.photos.map((ph) => (
                      <figure key={ph.id} className="relative break-inside-avoid overflow-hidden rounded-lg border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ph.url} alt={ph.milestoneTag} loading="lazy" className="w-full object-cover" />
                        <figcaption className={`absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${TAG_TONE[ph.milestoneTag] ?? 'bg-black/60 text-white'}`}>
                          {ph.milestoneTag}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

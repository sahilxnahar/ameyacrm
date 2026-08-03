'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Minus, Plus, X, Loader2, Users, CloudSun, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UniversalUploader } from '@/components/shared/universal-uploader';
import { saveDailySiteLog } from '@/server/actions/site-ops';

export const WEATHER_OPTIONS = ['Sunny', 'Partly cloudy', 'Cloudy', 'Light rain', 'Heavy rain', 'Windy', 'Hot', 'Foggy'] as const;
export const MILESTONE_TAGS = ['Foundation', 'Slab 1', 'Slab 2', 'Slab 3', 'Brickwork', 'Plastering', 'MEP', 'Waterproofing', 'Finishing', 'Handover', 'Other'] as const;

interface DraftPhoto { id: string; url: string; name: string; milestoneTag: string }

function todayISO(): string {
  // Local YYYY-MM-DD for the date input default.
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

export interface ProgrammeOption { id: string; projectId: string; name: string; percentComplete: number }

export function DailyLogForm({
  projects,
  activeProjectId,
  activities = [],
  onSaved,
}: {
  projects: { id: string; name: string }[];
  activeProjectId: string | null;
  /** Programme activities the engineer can move from this same form. */
  activities?: ProgrammeOption[];
  onSaved?: () => void;
}) {
  const [projectId, setProjectId] = React.useState(activeProjectId ?? projects[0]?.id ?? '');
  // Computed after mount, never during render. The server renders in UTC and
  // the phone is in IST, so between 00:00 and 05:30 IST the two disagree about
  // what day it is — a hydration mismatch and, worse, a site log dated
  // yesterday for anyone filling it in at night.
  const [date, setDate] = React.useState('');
  const [today, setToday] = React.useState('');
  React.useEffect(() => { const t = todayISO(); setToday(t); setDate((d) => d || t); }, []);
  const [weather, setWeather] = React.useState<string>(WEATHER_OPTIONS[0]);
  const [labor, setLabor] = React.useState(0);
  const [notes, setNotes] = React.useState('');
  const [currentTag, setCurrentTag] = React.useState<string>(MILESTONE_TAGS[0]);
  const [photos, setPhotos] = React.useState<DraftPhoto[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [activityId, setActivityId] = React.useState('');
  const [percent, setPercent] = React.useState<number | ''>('');
  const [shareWithBuyers, setShareWithBuyers] = React.useState(false);
  const seq = React.useRef(0);

  // Only this project's activities, and reset the pick when the project changes
  // so a percentage can never land on another project's programme.
  const projectActivities = React.useMemo(() => activities.filter((a) => a.projectId === projectId), [activities, projectId]);
  React.useEffect(() => { setActivityId(''); setPercent(''); }, [projectId]);
  React.useEffect(() => {
    if (!activityId) { setPercent(''); return; }
    const a = projectActivities.find((x) => x.id === activityId);
    setPercent(a ? a.percentComplete : '');
  }, [activityId, projectActivities]);

  const addPhoto = React.useCallback((f: { url: string; name: string }) => {
    seq.current += 1;
    setPhotos((prev) => [...prev, { id: `p${seq.current}`, url: f.url, name: f.name, milestoneTag: currentTag }]);
  }, [currentTag]);

  const setPhotoTag = (id: string, tag: string) => setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, milestoneTag: tag } : p)));
  const removePhoto = (id: string) => setPhotos((prev) => prev.filter((p) => p.id !== id));

  function submit() {
    if (!projectId) { toast.error('Pick a project.'); return; }
    if (!date) { toast.error('Pick a date.'); return; }
    setSaving(true);
    saveDailySiteLog({
      projectId,
      date,
      weather,
      laborCount: labor,
      notes,
      photos: photos.map((p) => ({ url: p.url, milestoneTag: p.milestoneTag, capturedAt: '' })),
      activityId: activityId || '',
      percentComplete: activityId && percent !== '' ? Number(percent) : undefined,
      shareWithBuyers: shareWithBuyers && photos.length > 0,
    }).then((r) => {
      setSaving(false);
      if ('error' in r) { toast.error(r.error); return; }
      const extra = [r.progressNote, r.sharedWithBuyers ? 'shared with buyers' : ''].filter(Boolean).join(' · ');
      toast.success(`Site log saved — ${r.photoCount} photo${r.photoCount === 1 ? '' : 's'}${extra ? ` · ${extra}` : ''}`);
      // Reset for the next entry (engineers often log several projects in a row).
      setLabor(0); setNotes(''); setPhotos([]); setActivityId(''); setPercent(''); setShareWithBuyers(false);
      onSaved?.();
    });
  }

  const stepBtn = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-background active:scale-95 disabled:opacity-40';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Project</Label>
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Select a project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} max={today || undefined} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label className="flex items-center gap-1"><CloudSun className="h-3.5 w-3.5" /> Weather</Label>
          <Select value={weather} onChange={(e) => setWeather(e.target.value)}>
            {WEATHER_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
          </Select>
        </div>
      </div>

      {/* Labour count — big +/- steppers so it works with gloves / one thumb. */}
      <div>
        <Label className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Total labour on site</Label>
        <div className="mt-1 flex items-center gap-3">
          <button type="button" aria-label="Decrease" className={stepBtn} disabled={labor <= 0} onClick={() => setLabor((n) => Math.max(0, n - 1))}><Minus className="h-5 w-5" /></button>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={labor}
            onChange={(e) => setLabor(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
            className="h-11 flex-1 text-center text-lg font-semibold"
          />
          <button type="button" aria-label="Increase" className={stepBtn} onClick={() => setLabor((n) => n + 1)}><Plus className="h-5 w-5" /></button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[5, 10, 25, 50].map((n) => (
            <button key={n} type="button" onClick={() => setLabor((c) => c + n)} className="rounded-full border px-3 py-1 text-xs font-medium active:scale-95">+{n}</button>
          ))}
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Concrete pour on Slab 2, RMC delayed 2h, safety toolbox talk done…" />
      </div>

      {/* Photos — camera-first, multiple, each tagged to a milestone. */}
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <Label className="mb-0">Site photos</Label>
          <div className="min-w-0">
            <span className="mb-1 block text-right text-[11px] text-muted-foreground">Tag new photos as</span>
            <Select value={currentTag} onChange={(e) => setCurrentTag(e.target.value)} className="h-9 w-auto">
              {MILESTONE_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
        </div>
        <UniversalUploader
          accept="image/jpeg,image/png"
          allowedMime={['image/jpeg', 'image/png']}
          onUploaded={(f) => addPhoto({ url: f.url, name: f.name })}
          label="Photograph the site"
          hint="tap to open the camera — add as many as you need"
          preview={false}
        />
        {photos.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((p) => (
              <div key={p.id} className="group relative overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.name} className="aspect-square w-full object-cover" />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => removePhoto(p.id)}
                  className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur active:scale-90"
                >
                  <X className="h-4 w-4" />
                </button>
                <select
                  value={p.milestoneTag}
                  onChange={(e) => setPhotoTag(p.id, e.target.value)}
                  className="absolute inset-x-0 bottom-0 w-full truncate border-0 bg-black/55 px-1.5 py-1 text-[11px] font-medium text-white outline-none"
                >
                  {MILESTONE_TAGS.map((t) => <option key={t} value={t} className="text-foreground">{t}</option>)}
                </select>
              </div>
            ))}
          </div>
        ) : null}
        {photos.length > 0 ? <p className="text-xs text-muted-foreground">{photos.length} photo{photos.length === 1 ? '' : 's'} attached</p> : null}
      </div>

      {/* Programme progress — the same visit that produced the photos is the one
          that knows how far the work got. Typing it here means nobody has to
          reconcile the diary against the schedule afterwards. */}
      {projectActivities.length > 0 && (
        <div className="rounded-lg border bg-muted/20 p-3">
          <Label className="flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" /> Programme progress <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_auto]">
            <Select value={activityId} onChange={(e) => setActivityId(e.target.value)}>
              <option value="">Don&apos;t update the programme</option>
              {projectActivities.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.percentComplete}%</option>)}
            </Select>
            <div className="flex items-center gap-2">
              <Input
                type="number" inputMode="numeric" min={0} max={100} disabled={!activityId}
                value={percent} onChange={(e) => setPercent(e.target.value === '' ? '' : Math.min(100, Math.max(0, Number(e.target.value))))}
                className="h-11 w-24 text-center text-lg font-semibold" placeholder="%"
              />
              <span className="text-sm text-muted-foreground">% done</span>
            </div>
          </div>
        </div>
      )}

      {/* Buyer portal — one tick instead of a second screen. */}
      <label className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', photos.length === 0 && 'opacity-50')}>
        <input
          type="checkbox" className="mt-0.5 h-4 w-4" disabled={photos.length === 0}
          checked={shareWithBuyers} onChange={(e) => setShareWithBuyers(e.target.checked)}
        />
        <span>
          <span className="font-medium">Show this to buyers</span>
          <span className="block text-xs text-muted-foreground">
            {photos.length === 0
              ? 'Add a photo first — a progress update without one is not worth sending.'
              : `Posts the first photo (${photos[0]?.milestoneTag}) and your notes to the customer portal as a progress update.`}
          </span>
        </span>
      </label>

      <div className="sticky bottom-0 -mx-1 flex justify-end gap-2 bg-gradient-to-t from-card via-card to-transparent pt-2">
        <Button onClick={submit} disabled={saving} className={cn('h-11 min-w-[8rem] gap-2', saving && 'opacity-80')}>
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Save site log'}
        </Button>
      </div>
    </div>
  );
}

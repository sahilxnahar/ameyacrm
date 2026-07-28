'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Minus, Plus, X, Loader2, Users, CloudSun } from 'lucide-react';
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

export function DailyLogForm({
  projects,
  activeProjectId,
  onSaved,
}: {
  projects: { id: string; name: string }[];
  activeProjectId: string | null;
  onSaved?: () => void;
}) {
  const [projectId, setProjectId] = React.useState(activeProjectId ?? projects[0]?.id ?? '');
  const [date, setDate] = React.useState(todayISO());
  const [weather, setWeather] = React.useState<string>(WEATHER_OPTIONS[0]);
  const [labor, setLabor] = React.useState(0);
  const [notes, setNotes] = React.useState('');
  const [currentTag, setCurrentTag] = React.useState<string>(MILESTONE_TAGS[0]);
  const [photos, setPhotos] = React.useState<DraftPhoto[]>([]);
  const [saving, setSaving] = React.useState(false);
  const seq = React.useRef(0);

  const addPhoto = React.useCallback((f: { url: string; name: string }) => {
    seq.current += 1;
    setPhotos((prev) => [...prev, { id: `p${seq.current}`, url: f.url, name: f.name, milestoneTag: currentTag }]);
  }, [currentTag]);

  const setPhotoTag = (id: string, tag: string) => setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, milestoneTag: tag } : p)));
  const removePhoto = (id: string) => setPhotos((prev) => prev.filter((p) => p.id !== id));

  function submit() {
    if (!projectId) { toast.error('Pick a project.'); return; }
    setSaving(true);
    saveDailySiteLog({
      projectId,
      date,
      weather,
      laborCount: labor,
      notes,
      photos: photos.map((p) => ({ url: p.url, milestoneTag: p.milestoneTag, capturedAt: '' })),
    }).then((r) => {
      setSaving(false);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`Site log saved — ${r.photoCount} photo${r.photoCount === 1 ? '' : 's'}`);
      // Reset for the next entry (engineers often log several projects in a row).
      setLabor(0); setNotes(''); setPhotos([]);
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
          <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
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

      <div className="sticky bottom-0 -mx-1 flex justify-end gap-2 bg-gradient-to-t from-card via-card to-transparent pt-2">
        <Button onClick={submit} disabled={saving} className={cn('h-11 min-w-[8rem] gap-2', saving && 'opacity-80')}>
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Save site log'}
        </Button>
      </div>
    </div>
  );
}

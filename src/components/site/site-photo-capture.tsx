'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { upload } from '@vercel/blob/client';
import { Camera, ImagePlus, Loader2, MapPin, Check, X, CloudOff } from 'lucide-react';
import { saveSitePhotos } from '@/server/actions/site-photos';

interface Recent { id: string; title: string; when: string; folder: string; fileId: string | null }
interface Shot { file: File; preview: string }

export function SitePhotoCapture({
  projects, activeProjectId, recent,
}: {
  projects: Array<{ id: string; name: string }>;
  activeProjectId: string | null;
  recent: Recent[];
}) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [projectId, setProjectId] = useState(activeProjectId ?? projects[0]?.id ?? '');
  const [caption, setCaption] = useState('');
  const [place, setPlace] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [pending, start] = useTransition();

  const add = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|heic|webp)$/i.test(f.name));
    setShots((s) => [...s, ...images.slice(0, 20 - s.length).map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    setMsg(null);
    // Ask for location once there is something to attach it to.
    if (!place && !locating && navigator.geolocation) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (p) => { setPlace({ lat: p.coords.latitude, lon: p.coords.longitude }); setLocating(false); },
        () => setLocating(false),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      );
    }
  };

  const send = () =>
    start(async () => {
      if (!shots.length) return;
      setMsg(null);
      try {
        const uploaded = [];
        for (const s of shots) {
          const blob = await upload(s.file.name, s.file, { access: 'public', handleUploadUrl: '/api/upload' });
          uploaded.push({ url: blob.url, name: s.file.name, size: s.file.size, mimeType: s.file.type });
        }
        const res = await saveSitePhotos({
          projectId, caption,
          latitude: place?.lat ?? null, longitude: place?.lon ?? null,
          takenAt: new Date().toISOString(),
          photos: uploaded,
        });
        if ('error' in res) { setMsg({ kind: 'err', text: res.error }); return; }
        setMsg({ kind: 'ok', text: res.message });
        shots.forEach((s) => URL.revokeObjectURL(s.preview));
        setShots([]); setCaption('');
      } catch (e) {
        setMsg({
          kind: 'err',
          text: e instanceof Error && /network|fetch|offline/i.test(e.message)
            ? 'No signal. Keep this page open — try again once you have a bar or two.'
            : e instanceof Error ? e.message : 'The upload failed.',
        });
      }
    });

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button" onClick={() => camera.current?.click()}
          className="focus-ring flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground shadow-sm active:scale-[0.99]"
        >
          <Camera className="h-7 w-7" />
          <span className="text-sm font-medium">Take a photo</span>
        </button>
        <button
          type="button" onClick={() => gallery.current?.click()}
          className="focus-ring flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-xl border bg-card shadow-sm active:scale-[0.99]"
        >
          <ImagePlus className="h-7 w-7 text-primary" />
          <span className="text-sm font-medium">Choose from the phone</span>
        </button>
      </div>

      <input
        ref={camera} type="file" accept="image/*" capture="environment" multiple className="hidden"
        onChange={(e) => { add(Array.from(e.target.files ?? [])); e.target.value = ''; }}
      />
      <input
        ref={gallery} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { add(Array.from(e.target.files ?? [])); e.target.value = ''; }}
      />

      {shots.length > 0 && (
        <div className="card-elevated space-y-4 p-4">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {shots.map((s, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-lg border">
                <Image src={s.preview} alt="" fill sizes="120px" className="object-cover" unoptimized />
                <button
                  type="button" onClick={() => setShots((x) => x.filter((_, j) => j !== i))}
                  aria-label="Remove this photo"
                  className="focus-ring absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Project</span>
              <select
                value={projectId} onChange={(e) => setProjectId(e.target.value)}
                className="focus-ring mt-1 w-full rounded-md border bg-background px-3 py-2 text-base"
              >
                <option value="">Unassigned</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">What is this? (optional)</span>
              <input
                value={caption} onChange={(e) => setCaption(e.target.value)}
                placeholder="3rd slab shuttering"
                className="focus-ring mt-1 w-full rounded-md border bg-background px-3 py-2 text-base"
              />
            </label>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {locating ? <><Loader2 className="h-3 w-3 animate-spin" />Finding where you are…</>
              : place ? <><MapPin className="h-3 w-3 text-primary" />Location will be saved with the photos</>
              : <><CloudOff className="h-3 w-3" />No location — the photos still file correctly</>}
          </p>

          <button
            type="button" onClick={send} disabled={pending}
            className="focus-ring w-full rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Filing {shots.length}…</> : `File ${shots.length} photo${shots.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {msg && (
        <p className={`flex items-start gap-2 rounded-md p-3 text-sm ${msg.kind === 'ok' ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'}`}>
          {msg.kind === 'ok' && <Check className="mt-0.5 h-4 w-4 shrink-0" />}{msg.text}
        </p>
      )}

      {recent.length > 0 && (
        <div>
          <h2 className="mb-2 font-display text-lg">Recently filed</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {recent.map((r) => (
              <a
                key={r.id} href={r.fileId ? `/api/files/${r.fileId}` : '#'} target="_blank" rel="noreferrer"
                className="focus-ring group overflow-hidden rounded-lg border bg-card"
              >
                <div className="relative aspect-square bg-muted">
                  {r.fileId && (
                    <Image src={`/api/files/${r.fileId}`} alt={r.title} fill sizes="160px" className="object-cover transition-transform group-hover:scale-105" unoptimized />
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium">{r.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{r.folder}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

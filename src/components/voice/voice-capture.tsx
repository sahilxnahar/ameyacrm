'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { toast } from 'sonner';
import { Mic, Square, Loader2, Upload, CheckCircle2, Wand2 } from 'lucide-react';
import { processVoiceNote, saveVoiceNote } from '@/server/actions/voice-note';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';

interface Opt { id: string; name: string }
interface Draft { transcript: string; kind: 'update' | 'task'; title: string; description: string; priority: string }
const sel = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm';

export function VoiceCapture({ projects, enabled }: { projects: Opt[]; enabled: boolean }) {
  const router = useRouter();
  const [recording, setRecording] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [projectId, setProjectId] = React.useState('');
  const [saved, setSaved] = React.useState<string | null>(null);
  const recRef = React.useRef<MediaRecorder | null>(null);
  const chunks = React.useRef<BlobPart[]>([]);

  const handleAudio = async (blob: Blob, filename: string) => {
    try {
      setBusy('Uploading…');
      const up = await upload(filename, blob, { access: 'public', handleUploadUrl: '/api/upload' });
      setBusy('Transcribing with AI…');
      const r = await processVoiceNote(up.url, blob.type || 'audio/webm');
      if ('error' in r) { toast.error(r.error); return; }
      setDraft(r.draft as Draft);
      toast.success('Transcribed — review and save');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not process the recording.');
    } finally { setBusy(null); }
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
        void handleAudio(blob, `site-note-${Date.now()}.webm`);
      };
      rec.start(); recRef.current = rec; setRecording(true);
    } catch { toast.error('Microphone blocked. Allow mic access, or upload an audio file instead.'); }
  };
  const stop = () => { recRef.current?.stop(); setRecording(false); };

  const save = () => {
    if (!draft) return;
    setBusy('Saving…');
    void (async () => {
      const r = await saveVoiceNote({ kind: draft.kind, title: draft.title, description: draft.description, priority: draft.priority, projectId: projectId || null, transcript: draft.transcript });
      setBusy(null);
      if ('error' in r) return toast.error(r.error);
      setSaved(r.kind); setDraft(null); router.refresh();
      toast.success(r.kind === 'update' ? 'Site update posted' : 'Task created');
    })();
  };

  if (!enabled) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Set <code>GEMINI_API_KEY</code> in Vercel to enable voice notes.</CardContent></Card>;

  if (saved) return (
    <Card><CardContent className="space-y-3 p-8 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
      <p className="font-medium">{saved === 'update' ? 'Site update posted' : 'Task created'}</p>
      <Button onClick={() => setSaved(null)}>Record another</Button>
    </CardContent></Card>
  );

  return (
    <Card><CardContent className="space-y-4 p-6">
      {!draft && (
        <>
          <p className="text-sm text-muted-foreground">Tap record and describe what you see on site. English, Hindi or Kannada all work.</p>
          <div className="flex flex-wrap items-center gap-3">
            {!recording ? (
              <Button size="lg" onClick={start} disabled={!!busy}><Mic className="h-5 w-5" /> Record</Button>
            ) : (
              <Button size="lg" variant="destructive" onClick={stop}><Square className="h-5 w-5" /> Stop &amp; transcribe</Button>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-secondary/40">
              <Upload className="h-4 w-4" /> Upload audio
              <input type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleAudio(f, f.name); e.target.value = ''; }} />
            </label>
            {recording && <span className="flex items-center gap-2 text-sm text-destructive"><span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> Recording…</span>}
            {busy && <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{busy}</span>}
          </div>
        </>
      )}

      {draft && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"><Wand2 className="h-4 w-4" /> AI draft — review before saving</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Save as</Label>
              <select className={sel} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Draft['kind'] })}>
                <option value="update">Site update</option><option value="task">Task</option>
              </select></div>
            <div className="space-y-1"><Label>Priority</Label>
              <select className={sel} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select></div>
          </div>
          <div className="space-y-1"><Label>Project{draft.kind === 'update' ? ' *' : ''}</Label>
            <select className={sel} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
          <div className="space-y-1"><Label>Title</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
          <div className="space-y-1"><Label>Description</Label><Textarea rows={4} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
          <details className="rounded-md border p-2">
            <summary className="cursor-pointer text-xs text-muted-foreground">Transcript</summary>
            <p className="mt-2 whitespace-pre-wrap text-xs text-foreground/75">{draft.transcript}</p>
          </details>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDraft(null)} disabled={!!busy}>Discard</Button>
            <Button onClick={save} disabled={!!busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</Button>
          </div>
        </div>
      )}
    </CardContent></Card>
  );
}

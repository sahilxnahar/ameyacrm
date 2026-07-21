'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Loader2, FileText, Eraser, CheckCircle2 } from 'lucide-react';
import { submitSignature, declineSignature } from '@/server/actions/signatures';

export function SignDocument({
  token, title, reference, fileUrl, signerName, requestedBy, message, expiresAt,
}: {
  token: string; title: string; reference: string; fileUrl: string;
  signerName: string; requestedBy: string | null; message: string | null; expiresAt: string | null;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = React.useState(false);
  const [hasInk, setHasInk] = React.useState(false);
  const [agreed, setAgreed] = React.useState(false);
  const [typed, setTyped] = React.useState(signerName);
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext('2d');
    if (ctx) { ctx.scale(ratio, ratio); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#14120E'; }
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return;
    const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y);
    setDrawing(true); setHasInk(true);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return;
    const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke();
  };
  const up = () => setDrawing(false);

  const clear = () => {
    const c = canvasRef.current; const ctx = c?.getContext('2d');
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  };

  const submit = async () => {
    if (!hasInk) { toast.error('Please draw your signature first.'); return; }
    if (!agreed) { toast.error('Please tick the box to confirm.'); return; }
    setPending(true);
    const data = canvasRef.current!.toDataURL('image/png');
    const r = await submitSignature(token, data, typed);
    setPending(false);
    if ('error' in r) { toast.error(r.error); return; }
    setDone(true);
  };

  const decline = async () => {
    const reason = window.prompt('Let them know why you are declining (optional):') ?? '';
    setPending(true);
    const r = await declineSignature(token, reason);
    setPending(false);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Recorded. They have been told.');
    setDone(true);
  };

  if (done) {
    return (
      <div className="space-y-2 text-center text-[#14120E]">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-700" />
        <h1 className="font-display text-2xl font-semibold tabular">Thank you</h1>
        <p className="text-sm">Your response to &ldquo;{title}&rdquo; has been recorded. A confirmation is on its way to you.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-[#14120E]">
      <div>
        <h1 className="font-display text-2xl font-semibold tabular">{title}</h1>
        <p className="text-sm text-[#5E584C]">
          {requestedBy ? `${requestedBy} has asked you to sign this.` : 'You have been asked to sign this document.'} Reference {reference}.
          {expiresAt && ` Valid until ${new Date(expiresAt).toLocaleDateString('en-IN')}.`}
        </p>
      </div>

      {message && <p className="rounded-md border border-[#D9D2C4] bg-white p-3 text-sm italic">&ldquo;{message}&rdquo;</p>}

      <a href={fileUrl} target="_blank" rel="noreferrer"
        className="flex items-center gap-2 rounded-md border border-[#D9D2C4] bg-white p-3 text-sm font-medium hover:bg-[#F3EFE7]">
        <FileText className="h-4 w-4" /> Read the document before signing
      </a>

      <div>
        <label className="mb-1 block text-sm font-medium">Your full name</label>
        <input value={typed} onChange={(e) => setTyped(e.target.value)}
          className="h-10 w-full rounded-md border border-[#D9D2C4] bg-white px-3 text-sm" />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium">Draw your signature</label>
          <button onClick={clear} className="flex items-center gap-1 text-xs text-[#5E584C] underline"><Eraser className="h-3 w-3" /> Clear</button>
        </div>
        <canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
          className="h-40 w-full touch-none rounded-md border border-dashed border-[#B9B0A0] bg-white" />
        <p className="mt-1 text-xs text-[#5E584C]">Use your finger on a phone, or the mouse on a computer.</p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>I have read the document and I agree to sign it electronically. I understand the date, time and my network address will be recorded alongside my signature.</span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button onClick={submit} disabled={pending}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#A07D34] px-4 text-sm font-medium text-white disabled:opacity-60">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Sign this document
        </button>
        <button onClick={decline} disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-md border border-[#D9D2C4] bg-white px-4 text-sm">
          Decline
        </button>
      </div>
    </div>
  );
}

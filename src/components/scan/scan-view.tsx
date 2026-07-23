'use client';
import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { resolveScannedCode, type ScanMatch } from '@/server/actions/scan';

const REGION_ID = 'ameya-qr-region';

export function ScanView() {
  const [scanning, setScanning] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);
  const [match, setMatch] = React.useState<ScanMatch | null>(null);
  const [manual, setManual] = React.useState('');
  const scannerRef = React.useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  const stop = React.useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) { try { await s.stop(); s.clear(); } catch { /* already stopped */ } }
    setScanning(false);
  }, []);

  const resolve = React.useCallback((text: string) => {
    setResult(text); setMatch(null);
    (async () => {
      const r = await resolveScannedCode(text);
      if (!('error' in r)) setMatch(r.data);
    })();
  }, []);

  const startCamera = async () => {
    setResult(null); setMatch(null);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
      scannerRef.current = scanner as unknown as { stop: () => Promise<void>; clear: () => void };
      setScanning(true);
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded: string) => { resolve(decoded); void stop(); toast.success('Code scanned'); },
        () => { /* per-frame decode misses are normal */ },
      );
    } catch (e) {
      setScanning(false);
      toast.error(e instanceof Error && /permission|NotAllowed/i.test(e.message) ? 'Camera permission denied. Allow the camera, or type the code below.' : 'Could not start the camera. Type the code below instead.');
    }
  };

  React.useEffect(() => () => { void stop(); }, [stop]);

  const isUrl = result ? /^https?:\/\//i.test(result) : false;
  const isPath = result ? /^\//.test(result) : false;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#1B2A4A]">Scan a QR or Barcode</h1>
        <p className="text-sm text-muted-foreground">Point the camera at a unit QR, a material barcode or any code. Works on the phone camera and laptop webcams; you can also type a code by hand.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div id={REGION_ID} className={`mx-auto w-full max-w-xs overflow-hidden rounded-md ${scanning ? 'border border-[#1B2A4A]' : ''}`} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!scanning ? (
            <button onClick={startCamera} className="rounded-md bg-[#1B2A4A] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#243a63]">Start camera</button>
          ) : (
            <button onClick={() => void stop()} className="rounded-md border border-slate-300 px-4 py-1.5 text-sm hover:bg-slate-50">Stop</button>
          )}
          <span className="text-xs text-muted-foreground">{scanning ? 'Scanning…' : 'Camera is off'}</span>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) resolve(manual.trim()); }} className="flex gap-2">
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="…or type / paste a code" className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm" />
        <button className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Look up</button>
      </form>

      {result && (
        <div className="rounded-lg border border-[#A07D34]/40 bg-[#A07D34]/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Scanned</span>
            <button onClick={() => void navigator.clipboard?.writeText(result).then(() => toast.success('Copied'))} className="text-xs text-[#1B2A4A] hover:underline">Copy</button>
          </div>
          <p className="break-all font-mono text-sm">{result}</p>

          <div className="mt-3 space-y-2">
            {isUrl && <a href={result} target="_blank" rel="noopener noreferrer" className="inline-block rounded bg-[#1B2A4A] px-3 py-1.5 text-sm font-semibold text-white">Open link ↗</a>}
            {isPath && <Link href={result} className="inline-block rounded bg-[#1B2A4A] px-3 py-1.5 text-sm font-semibold text-white">Open in CRM →</Link>}

            {match && match.units.length === 0 && match.slots.length === 0 && !isUrl && !isPath && (
              <p className="text-xs text-muted-foreground">No unit or parking slot matches this code. It may be a material barcode or an external code.</p>
            )}
            {match && match.units.map((u) => (
              <Link key={u.id} href="/inventory" className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">
                <span><b>Unit {u.code}</b>{u.typology ? ` · ${u.typology}` : ''}{u.tower ? ` · ${u.tower}` : ''}</span>
                <span className="text-xs text-muted-foreground">{u.status} · open Inventory →</span>
              </Link>
            ))}
            {match && match.slots.map((s) => (
              <Link key={s.id} href="/parking" className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">
                <span><b>Parking {s.code}</b>{s.level ? ` · ${s.level}` : ''}</span>
                <span className="text-xs text-muted-foreground">{s.status} · open Parking →</span>
              </Link>
            ))}
          </div>

          <button onClick={() => { setResult(null); setMatch(null); setManual(''); }} className="mt-3 text-xs text-[#1B2A4A] hover:underline">Scan another</button>
        </div>
      )}
    </div>
  );
}

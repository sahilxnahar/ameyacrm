'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { extractGrnFromImage, createGoodsReceipt, type GrnExtract } from '@/server/actions/compliance';

type Form = {
  vendorName: string; materialName: string; poReference: string; unit: string;
  orderedQty: string; receivedQty: string; billedQty: string; rate: string; receivedOn: string; note: string;
};
const EMPTY: Form = { vendorName: '', materialName: '', poReference: '', unit: '', orderedQty: '', receivedQty: '', billedQty: '', rate: '', receivedOn: '', note: '' };

function fromExtract(d: GrnExtract): Form {
  const s = (x: string | null) => x ?? '';
  const n = (x: number | null) => (x == null ? '' : String(x));
  return { vendorName: s(d.vendorName), materialName: s(d.materialName), poReference: s(d.poReference), unit: s(d.unit), orderedQty: n(d.orderedQty), receivedQty: n(d.receivedQty), billedQty: n(d.billedQty), rate: n(d.rate), receivedOn: d.receivedOn ? d.receivedOn.slice(0, 10) : '', note: s(d.note) };
}

export function GrnScanner({ projectId }: { projectId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reading, setReading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [scanned, setScanned] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReading(true); setScanned(false);
    try {
      const dataUrl: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
      if (file.type.startsWith('image/')) setPreview(dataUrl);
      const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl;
      const r = await extractGrnFromImage({ dataBase64: base64, mimeType: file.type, filename: file.name });
      if ('error' in r) { toast.error(r.error); return; }
      setForm(fromExtract(r.data)); setScanned(true);
      toast.success('Scanned — please check the details before saving.');
    } catch {
      toast.error('Could not read that file.');
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    if (form.vendorName.trim().length < 2 || form.materialName.trim().length < 2) { toast.error('Vendor and material are required.'); return; }
    setSaving(true);
    try {
      const r = await createGoodsReceipt({ ...form, projectId: projectId ?? '' });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Goods receipt recorded.'); setForm(EMPTY); setScanned(false); setPreview(null); setOpen(false); router.refresh();
    } finally { setSaving(false); }
  };

  const cls = 'rounded border border-slate-300 px-2 py-1 text-sm';
  return (
    <div className="rounded-lg border border-[#A07D34]/40 bg-[#A07D34]/5 p-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#1B2A4A]">Scan a goods-receipt note (AI)</h3>
          <p className="text-xs text-muted-foreground">Photograph or upload the delivery challan — the AI reads the vendor, material and quantities so you don’t have to type them.</p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="shrink-0 rounded-md bg-[#1B2A4A] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#243a63]">{open ? 'Close' : 'Scan GRN'}</button>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" onChange={onFile} disabled={reading} className="text-sm" />
            {reading && <span className="text-xs text-[#A07D34]">Reading the document…</span>}
          </div>
          {preview && <img src={preview} alt="GRN preview" className="max-h-40 rounded border border-slate-200" />}

          {(scanned || reading) && (
            <div className="grid gap-2 sm:grid-cols-2">
              <L label="Vendor *"><input value={form.vendorName} onChange={(e) => set('vendorName', e.target.value)} className={`${cls} w-full`} /></L>
              <L label="Material *"><input value={form.materialName} onChange={(e) => set('materialName', e.target.value)} className={`${cls} w-full`} /></L>
              <L label="PO reference"><input value={form.poReference} onChange={(e) => set('poReference', e.target.value)} className={`${cls} w-full`} /></L>
              <L label="Unit"><input value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="bags, cft, nos" className={`${cls} w-full`} /></L>
              <L label="Ordered qty"><input value={form.orderedQty} onChange={(e) => set('orderedQty', e.target.value)} inputMode="decimal" className={`${cls} w-full`} /></L>
              <L label="Received qty"><input value={form.receivedQty} onChange={(e) => set('receivedQty', e.target.value)} inputMode="decimal" className={`${cls} w-full`} /></L>
              <L label="Billed qty"><input value={form.billedQty} onChange={(e) => set('billedQty', e.target.value)} inputMode="decimal" className={`${cls} w-full`} /></L>
              <L label="Rate (₹)"><input value={form.rate} onChange={(e) => set('rate', e.target.value)} inputMode="decimal" className={`${cls} w-full`} /></L>
              <L label="Received on"><input type="date" value={form.receivedOn} onChange={(e) => set('receivedOn', e.target.value)} className={`${cls} w-full`} /></L>
              <L label="Note"><input value={form.note} onChange={(e) => set('note', e.target.value)} className={`${cls} w-full`} /></L>
            </div>
          )}

          {scanned && (
            <div className="flex items-center gap-2">
              <button onClick={save} disabled={saving} className="rounded bg-[#1B2A4A] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save goods receipt'}</button>
              <button onClick={() => { setForm(EMPTY); setScanned(false); setPreview(null); }} className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-white">Clear</button>
              <span className="text-xs text-muted-foreground">Always check the figures — OCR can misread a smudged challan.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs">{label}<br />{children}</label>;
}

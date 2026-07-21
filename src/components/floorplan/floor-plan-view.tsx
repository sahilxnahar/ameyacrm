'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { upload } from '@vercel/blob/client';
import { Loader2, Plus, Save, Trash2, MousePointerClick, Pencil, ImageUp, X, Share2, Copy } from 'lucide-react';
import { createFloorPlan, deleteFloorPlan, savePins, toggleShare } from '@/server/actions/floor-plans';
import { PLAN_KINDS, PLAN_KIND_LABEL, type PlanKind } from '@/config/floor-plans';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils/cn';

interface Unit { id: string; code: string; projectId: string; tower: string | null; floor: number | null; typology: string | null; area: number; price: number; status: string; facing: string | null }
interface Pin { id?: string; unitId: string; x: number; y: number; w: number; h: number }
interface Plan { id: string; projectId: string; name: string; tower: string | null; floor: number | null; imageUrl: string; kind: string; description: string | null; isPublic: boolean; shareToken: string | null; pins: Pin[] }

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'rgba(16,150,80,0.55)',
  HELD: 'rgba(217,119,6,0.6)',
  BOOKED: 'rgba(37,99,235,0.6)',
  SOLD: 'rgba(120,113,108,0.65)',
  BLOCKED: 'rgba(190,18,60,0.55)',
};
const money = (n: number) => (n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1)} L` : `₹${n.toLocaleString('en-IN')}`);

export function FloorPlanView({
  plans, units, projects, canManage,
}: {
  plans: Plan[]; units: Unit[];
  projects: { id: string; name: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [planId, setPlanId] = React.useState(plans[0]?.id ?? '');
  const [edit, setEdit] = React.useState(false);
  const [pins, setPins] = React.useState<Pin[]>([]);
  const [picked, setPicked] = React.useState<Unit | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [imageUrl, setImageUrl] = React.useState('');
  const boxRef = React.useRef<HTMLDivElement>(null);

  const plan = plans.find((p) => p.id === planId) ?? null;
  React.useEffect(() => { setPins(plan?.pins ?? []); setPicked(null); }, [planId]); // eslint-disable-line react-hooks/exhaustive-deps

  const unitById = React.useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const placed = new Set(pins.map((p) => p.unitId));
  const candidates = plan
    ? units.filter((u) => u.projectId === plan.projectId && !placed.has(u.id) &&
        (plan.tower ? (u.tower ?? '') === plan.tower : true) &&
        (plan.floor === null || u.floor === plan.floor))
    : [];

  /** Drop a box wherever they click, sized as a share of the image. */
  const placeNext = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!edit || !candidates.length || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    const next = candidates[0];
    if (!next) return; // every unit on this plan is already placed
    setPins([...pins, { unitId: next.id, x: Math.max(0, x - 4), y: Math.max(0, y - 3), w: 8, h: 6 }]);
  };

  const nudge = (i: number, dx: number, dy: number) =>
    setPins(pins.map((p, j) => (j === i ? { ...p, x: Math.min(97, Math.max(0, p.x + dx)), y: Math.min(97, Math.max(0, p.y + dy)) } : p)));

  const resize = (i: number, dw: number, dh: number) =>
    setPins(pins.map((p, j) => (j === i ? { ...p, w: Math.min(60, Math.max(2, p.w + dw)), h: Math.min(60, Math.max(2, p.h + dh)) } : p)));

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const blob = await upload(file.name, file, { access: 'public', handleUploadUrl: '/api/upload' });
      setImageUrl(blob.url);
      toast.success('Plan uploaded');
    } catch {
      toast.error('Upload failed. Check that file storage is configured.');
    } finally { setUploading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {plans.length === 0 && <option value="">No plans yet</option>}
          {plans.map((p) => (
            <option key={p.id} value={p.id}>{[p.name, p.tower && `Tower ${p.tower}`, p.floor !== null && `Floor ${p.floor}`].filter(Boolean).join(' · ')}</option>
          ))}
        </select>

        {canManage && (
          <>
            <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New plan</Button>
            {plan && (
              <>
                <Button size="sm" variant={edit ? 'default' : 'outline'} onClick={() => setEdit(!edit)}
                  title={edit ? 'Stop placing units' : 'Click the plan to place units on it'}>
                  <Pencil className="h-4 w-4" /> {edit ? 'Done placing' : 'Place units'}
                </Button>
                {edit && (
                  <Button size="sm" disabled={pending} onClick={() => start(async () => {
                    const r = await savePins(plan.id, pins.map(({ unitId, x, y, w, h }) => ({ unitId, x, y, w, h })));
                    if ('error' in r) { toast.error(r.error); return; }
                    toast.success('Layout saved'); setEdit(false); router.refresh();
                  })}>
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save layout
                  </Button>
                )}
                <Button size="sm" variant={plan.isPublic ? 'default' : 'outline'} disabled={pending}
                  title={plan.isPublic ? 'Stop sharing this plan' : 'Create a link a buyer can open — availability only, no prices'}
                  onClick={() => start(async () => {
                    const r = await toggleShare(plan.id, !plan.isPublic);
                    if ('error' in r) { toast.error(r.error); return; }
                    toast.success(plan.isPublic ? 'Sharing stopped' : 'Share link created');
                    router.refresh();
                  })}>
                  <Share2 className="h-4 w-4" /> {plan.isPublic ? 'Shared' : 'Share'}
                </Button>
                {plan.isPublic && plan.shareToken && (
                  <Button size="sm" variant="outline" title="Copy the buyer link"
                    onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/plan/${plan.shareToken}`); toast.success('Link copied'); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-destructive" disabled={pending}
                  onClick={() => { if (confirm(`Delete "${plan.name}"? The units themselves are not affected.`)) start(async () => { await deleteFloorPlan(plan.id); router.refresh(); }); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </>
        )}

        <span className="chip-row ml-auto w-full sm:w-auto">
          {Object.entries(STATUS_COLOR).map(([k, c]) => (
            <span key={k} className="flex items-center gap-1 rounded-full border px-2 py-1 text-[11px]">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} /> {k.toLowerCase()}
            </span>
          ))}
        </span>
      </div>

      {!plan ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No floor plans yet. Upload a plan image, then click on it to place each flat.
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <Card className="overflow-hidden p-2">
            {edit && (
              <p className="mb-2 flex items-center gap-2 rounded-md bg-primary/10 p-2 text-xs">
                <MousePointerClick className="h-3.5 w-3.5" />
                {candidates.length
                  ? <>Click the plan to place <strong>{candidates[0]?.code}</strong> — {candidates.length} left to place.</>
                  : <>Every unit for this plan is placed.</>}
              </p>
            )}
            <div ref={boxRef} onClick={placeNext}
              className={cn('relative w-full select-none', edit && candidates.length && 'cursor-crosshair')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={plan.imageUrl} alt={plan.name} className="w-full rounded-md" draggable={false} />
              {pins.map((p, i) => {
                const u = unitById.get(p.unitId);
                if (!u) return null;
                return (
                  <button key={p.unitId} onClick={(e) => { e.stopPropagation(); setPicked(u); }}
                    style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%`, background: STATUS_COLOR[u.status] ?? STATUS_COLOR.AVAILABLE }}
                    className={cn('absolute flex items-center justify-center rounded border border-white/70 text-[9px] font-semibold text-white shadow-sm transition-transform hover:scale-105 sm:text-[11px]',
                      picked?.id === u.id && 'ring-2 ring-white')}
                    title={`${u.code} · ${u.typology} · ${u.status}`}>
                    {u.code}
                  </button>
                );
              })}
            </div>

            {edit && pins.length > 0 && (
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                {pins.map((p, i) => {
                  const u = unitById.get(p.unitId);
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="w-16 shrink-0 font-medium">{u?.code}</span>
                      <span className="flex gap-0.5">
                        {(['←', '→', '↑', '↓'] as const).map((a, k) => (
                          <button key={a} className="h-6 w-6 rounded border" onClick={() => nudge(i, k === 0 ? -1 : k === 1 ? 1 : 0, k === 2 ? -1 : k === 3 ? 1 : 0)}>{a}</button>
                        ))}
                        <button className="h-6 w-6 rounded border" onClick={() => resize(i, 1, 1)}>+</button>
                        <button className="h-6 w-6 rounded border" onClick={() => resize(i, -1, -1)}>−</button>
                        <button className="h-6 w-6 rounded border text-destructive" onClick={() => setPins(pins.filter((_, j) => j !== i))}><X className="mx-auto h-3 w-3" /></button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-3">
            {picked ? (
              <div className="space-y-2">
                <p className="font-display text-xl font-semibold">{picked.code}</p>
                <Badge variant={picked.status === 'AVAILABLE' ? 'success' : picked.status === 'HELD' ? 'warning' : 'secondary'}>{picked.status}</Badge>
                <dl className="space-y-1 text-sm">
                  <Row k="Typology" v={picked.typology ?? "—"} />
                  <Row k="Carpet area" v={`${picked.area.toLocaleString('en-IN')} sqft`} />
                  <Row k="Floor" v={String(picked.floor)} />
                  {picked.tower && <Row k="Tower" v={picked.tower} />}
                  {picked.facing && <Row k="Facing" v={picked.facing} />}
                  <Row k="Price" v={money(picked.price)} />
                  {picked.area > 0 && <Row k="Rate" v={`₹${Math.round(picked.price / picked.area).toLocaleString('en-IN')}/sqft`} />}
                </dl>
                <Button asChild size="sm" className="w-full"><a href={`/inventory?unit=${picked.id}`}>Open in inventory</a></Button>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Tap a flat on the plan to see its details.</p>
            )}
          </Card>
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New floor plan</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            if (!imageUrl) { toast.error('Upload the plan image first.'); return; }
            start(async () => {
              const r = await createFloorPlan({ ...Object.fromEntries(fd), imageUrl });
              if ('error' in r) { toast.error(r.error); return; }
              toast.success('Plan added — now press “Place units”');
              setNewOpen(false); setImageUrl(''); router.refresh();
            });
          }}>
            <div className="space-y-1.5"><Label htmlFor="projectId">Project</Label>
              <select id="projectId" name="projectId" required className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="kind">What kind of plan?</Label>
              <select id="kind" name="kind" defaultValue="FLOOR" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                {PLAN_KINDS.map((k) => <option key={k} value={k}>{PLAN_KIND_LABEL[k]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" name="name" required placeholder="Typical floor — Tower A" /></div>
            <div className="space-y-1.5"><Label htmlFor="description">Note for buyers <span className="font-normal opacity-70">(optional)</span></Label><Input id="description" name="description" placeholder="All homes east-facing with balcony" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="tower">Tower <span className="font-normal opacity-70">(optional)</span></Label><Input id="tower" name="tower" placeholder="A" /></div>
              <div className="space-y-1.5"><Label htmlFor="floor">Floor <span className="font-normal opacity-70">(optional)</span></Label><Input id="floor" name="floor" type="number" placeholder="3" /></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="img">Plan image</Label>
              <input id="img" type="file" accept="image/*" className="text-sm"
                onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
              {uploading && <p className="flex items-center gap-1.5 text-xs"><Loader2 className="h-3 w-3 animate-spin" /> uploading…</p>}
              {imageUrl && <p className="flex items-center gap-1.5 text-xs text-success"><ImageUp className="h-3 w-3" /> ready</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending || uploading}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Add plan</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>;
}

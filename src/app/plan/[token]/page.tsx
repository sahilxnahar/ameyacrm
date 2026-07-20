import type { Metadata } from 'next';
import { prisma } from '@/lib/db/prisma';
import { PLAN_KIND_LABEL, type PlanKind } from '@/config/floor-plans';

export const metadata: Metadata = { title: 'Floor plan' };
export const dynamic = 'force-dynamic';

const COLOR: Record<string, string> = {
  AVAILABLE: 'rgba(16,150,80,0.55)',
  HELD: 'rgba(217,119,6,0.6)',
  BOOKED: 'rgba(37,99,235,0.6)',
  SOLD: 'rgba(120,113,108,0.65)',
  BLOCKED: 'rgba(190,18,60,0.55)',
};

/**
 * Public plan for a buyer. Shows which flats are still going; deliberately
 * shows no prices — availability is a selling point, your rate card is not
 * something to leave lying on the internet.
 */
export default async function PublicPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const plan = await prisma.floorPlan.findUnique({
    where: { shareToken: token },
    include: { project: { select: { name: true } }, pins: { include: { unit: { select: { code: true, typology: true, carpetAreaSqft: true, status: true, facing: true } } } } },
  });

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen w-full" style={{ background: 'linear-gradient(125deg, #04123A 0%, #0A2A6B 18%, #12409E 36%, #1E5FD6 52%, #6D9BEA 68%, #B9CFEF 82%, #F7F3EA 100%)' }}>
      <div className="mx-auto max-w-4xl p-4">
        <div className="rounded-2xl bg-[#FBF9F4] p-4 shadow-2xl sm:p-6">{children}</div>
      </div>
    </div>
  );

  if (!plan || !plan.isPublic) {
    return shell(<p className="py-10 text-center text-sm text-[#14120E]">This plan is not available. Please ask for a fresh link.</p>);
  }

  const available = plan.pins.filter((p) => p.unit.status === 'AVAILABLE').length;

  return shell(
    <div className="text-[#14120E]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#8C6E2C]">Ameya Heights</p>
      <h1 className="font-display text-2xl font-semibold">{plan.name}</h1>
      <p className="text-sm text-[#5E584C]">
        {[plan.project.name, PLAN_KIND_LABEL[plan.kind as PlanKind] ?? plan.kind, plan.tower && `Tower ${plan.tower}`, plan.floor !== null && `Floor ${plan.floor}`]
          .filter(Boolean).join(' · ')}
      </p>
      {plan.description && <p className="mt-2 text-sm">{plan.description}</p>}

      <p className="mt-3 text-sm font-medium text-emerald-800">{available} of {plan.pins.length} homes still available</p>

      <div className="relative mt-3 w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={plan.imageUrl} alt={plan.name} className="w-full rounded-lg" />
        {plan.pins.map((p) => (
          <span key={p.id}
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%`, background: COLOR[p.unit.status] ?? COLOR.AVAILABLE }}
            className="absolute flex items-center justify-center rounded border border-white/70 text-[9px] font-semibold text-white sm:text-[11px]"
            title={`${p.unit.code} · ${p.unit.typology} · ${p.unit.status}`}>
            {p.unit.code}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {Object.entries(COLOR).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: c }} /> {k.toLowerCase()}
          </span>
        ))}
      </div>

      <table className="mt-4 w-full text-sm">
        <thead className="border-b text-left text-xs uppercase tracking-wider text-[#5E584C]">
          <tr><th className="py-2">Home</th><th>Type</th><th className="text-right">Carpet area</th><th>Facing</th><th>Status</th></tr>
        </thead>
        <tbody>
          {plan.pins.map((p) => (
            <tr key={p.id} className="border-b last:border-0">
              <td className="py-2 font-medium">{p.unit.code}</td>
              <td>{p.unit.typology}</td>
              <td className="text-right tabular">{Number(p.unit.carpetAreaSqft).toLocaleString('en-IN')} sqft</td>
              <td>{p.unit.facing ?? '—'}</td>
              <td>{p.unit.status.toLowerCase()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-xs text-[#5E584C]">
        Availability shown at the time of viewing and subject to change. For prices and payment plans please speak to our sales team.
        Ameya Heights LLP · ameyaheights.com
      </p>
    </div>,
  );
}

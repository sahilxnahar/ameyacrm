'use client';

import { RegisterScreen } from '@/components/common/register-screen';
import { formatCurrency } from '@/lib/utils/format';
import {
  createContract, createInsurancePolicy, createRenewal, createSop, createLesson,
  createWasteManifest, createAccessReview, createPowerOfAttorney, createJda,
} from '@/server/actions/compliance';

/**
 * The nine registers that had database tables and no screens.
 *
 * Every one of them is a list a developer already keeps somewhere — a contract
 * folder, an insurance file, a waste-disposal book, the JDA in the safe. They
 * are built on the shared RegisterScreen so each is configuration rather than
 * another hand-written table, and they live on the screens whose menu
 * descriptions have been promising them.
 */

const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');
const opt = (a: string[]) => a.map((v) => ({ value: v, label: v.replace(/_/g, ' ').toLowerCase() }));

/** Days until a date, rendered so "already gone" is unmistakable. */
function Due({ on }: { on: Date | null }) {
  if (!on) return <span className="text-muted-foreground">—</span>;
  const days = Math.round((new Date(on).getTime() - Date.now()) / 86_400_000);
  const cls = days < 0 ? 'text-destructive font-medium' : days <= 30 ? 'text-amber-600 font-medium' : 'text-muted-foreground';
  return <span className={cls}>{fmt(on)}{days < 0 ? ` · ${Math.abs(days)}d ago` : days <= 90 ? ` · in ${days}d` : ''}</span>;
}

interface Proj { id: string; name: string }
interface Base { projects?: Proj[]; projectId?: string | null; canManage: boolean }

// ── Governance ───────────────────────────────────────────────────────────────

export interface ContractRow { id: string; title: string; counterparty: string; kind: string | null; value: number | null; startsOn: Date | null; endsOn: Date | null; renewalOn: Date | null; status: string }
export function ContractsRegister({ rows, projects, projectId, canManage }: Base & { rows: ContractRow[] }) {
  const soon = rows.filter((r) => r.renewalOn && new Date(r.renewalOn).getTime() - Date.now() < 60 * 86_400_000).length;
  return (
    <RegisterScreen<ContractRow>
      basePath="/governance?view=contracts" projects={projects} projectId={projectId} canManage={canManage} rows={rows}
      addLabel="Add a contract"
      emptyText="No contracts on the register. Add each one with its renewal date — a contract that auto-renews unnoticed is the expensive kind."
      onCreate={(v) => createContract({ ...v, projectId: projectId ?? '' })}
      tiles={[
        { label: 'Contracts', value: String(rows.length) },
        { label: 'Active', value: String(rows.filter((r) => r.status === 'ACTIVE').length) },
        { label: 'Renewing in 60 days', value: String(soon), tone: soon > 0 ? 'bad' : 'default' },
      ]}
      columns={[
        { label: 'Contract', render: (r) => r.title },
        { label: 'With', render: (r) => r.counterparty },
        { label: 'Type', render: (r) => r.kind ?? '—' },
        { label: 'Value', render: (r) => formatCurrency(r.value) },
        { label: 'Ends', render: (r) => fmt(r.endsOn) },
        { label: 'Renewal', render: (r) => <Due on={r.renewalOn} /> },
        { label: 'Status', render: (r) => r.status.toLowerCase() },
      ]}
      fields={[
        { name: 'title', label: 'Contract', required: true, placeholder: 'Lift maintenance AMC' },
        { name: 'counterparty', label: 'With', required: true, placeholder: 'Otis India Pvt Ltd' },
        { name: 'kind', label: 'Type', placeholder: 'AMC, lease, works, supply…' },
        { name: 'value', label: 'Value', type: 'currency' },
        { name: 'startsOn', label: 'Starts', type: 'date' },
        { name: 'endsOn', label: 'Ends', type: 'date' },
        { name: 'renewalOn', label: 'Decide renewal by', type: 'date', hint: 'The date you must act, not the date it expires.' },
        { name: 'status', label: 'Status', type: 'select', options: opt(['ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED']) },
        { name: 'obligations', label: 'Key obligations', type: 'textarea', advanced: true },
      ]}
    />
  );
}

export interface PolicyRow { id: string; name: string; insurer: string; policyNo: string | null; cover: number | null; premium: number | null; expiresOn: Date | null }
export function InsuranceRegister({ rows, projects, projectId, canManage }: Base & { rows: PolicyRow[] }) {
  const lapsed = rows.filter((r) => r.expiresOn && new Date(r.expiresOn).getTime() < Date.now()).length;
  return (
    <RegisterScreen<PolicyRow>
      basePath="/governance?view=insurance" projects={projects} projectId={projectId} canManage={canManage} rows={rows}
      addLabel="Add a policy"
      emptyText="No policies recorded. A construction site with lapsed CAR or workmen's cover is an uninsured site."
      onCreate={(v) => createInsurancePolicy({ ...v, projectId: projectId ?? '' })}
      tiles={[
        { label: 'Policies', value: String(rows.length) },
        { label: 'Total cover', value: formatCurrency(rows.reduce((t, r) => t + (r.cover ?? 0), 0)) },
        { label: 'Lapsed', value: String(lapsed), tone: lapsed > 0 ? 'bad' : 'good' },
      ]}
      columns={[
        { label: 'Policy', render: (r) => r.name },
        { label: 'Insurer', render: (r) => r.insurer },
        { label: 'Number', render: (r) => r.policyNo ?? '—' },
        { label: 'Cover', render: (r) => formatCurrency(r.cover) },
        { label: 'Premium', render: (r) => formatCurrency(r.premium) },
        { label: 'Expires', render: (r) => <Due on={r.expiresOn} /> },
      ]}
      fields={[
        { name: 'name', label: 'Policy', required: true, placeholder: "Contractor's All Risk" },
        { name: 'insurer', label: 'Insurer', required: true },
        { name: 'policyNo', label: 'Policy number' },
        { name: 'cover', label: 'Sum insured', type: 'currency' },
        { name: 'premium', label: 'Premium', type: 'currency' },
        { name: 'expiresOn', label: 'Expires', type: 'date' },
        { name: 'claims', label: 'Claims history', type: 'textarea', advanced: true },
      ]}
    />
  );
}

export interface RenewalRow { id: string; title: string; category: string | null; reference: string | null; expiresOn: Date | null; owner: string | null; renewed: boolean }
export function RenewalsRegister({ rows, projects, projectId, canManage }: Base & { rows: RenewalRow[] }) {
  const overdue = rows.filter((r) => !r.renewed && r.expiresOn && new Date(r.expiresOn).getTime() < Date.now()).length;
  return (
    <RegisterScreen<RenewalRow>
      basePath="/governance?view=renewals" projects={projects} projectId={projectId} canManage={canManage} rows={rows}
      addLabel="Track a renewal"
      emptyText="Nothing on the renewals watch. Trade licence, fire NOC, lift licence, labour licence, RERA extension — the ones that stop work when they lapse."
      onCreate={(v) => createRenewal({ ...v, projectId: projectId ?? '' })}
      tiles={[
        { label: 'Tracked', value: String(rows.length) },
        { label: 'Outstanding', value: String(rows.filter((r) => !r.renewed).length) },
        { label: 'Already expired', value: String(overdue), tone: overdue > 0 ? 'bad' : 'good' },
      ]}
      columns={[
        { label: 'Document', render: (r) => r.title },
        { label: 'Category', render: (r) => r.category ?? '—' },
        { label: 'Reference', render: (r) => r.reference ?? '—' },
        { label: 'Owner', render: (r) => r.owner ?? '—' },
        { label: 'Expires', render: (r) => <Due on={r.expiresOn} /> },
        { label: 'Renewed', render: (r) => (r.renewed ? 'yes' : 'not yet') },
      ]}
      fields={[
        { name: 'title', label: 'Document', required: true, placeholder: 'Fire NOC' },
        { name: 'category', label: 'Category', placeholder: 'licence, NOC, certificate…' },
        { name: 'reference', label: 'Reference number' },
        { name: 'owner', label: 'Who chases it' },
        { name: 'expiresOn', label: 'Expires', type: 'date' },
        { name: 'renewed', label: 'Already renewed?', type: 'select', options: [{ value: 'NO', label: 'not yet' }, { value: 'YES', label: 'yes' }] },
      ]}
    />
  );
}

// ── Knowledge ────────────────────────────────────────────────────────────────

export interface SopRow { id: string; title: string; department: string | null; version: number; status: string; effectiveOn: Date | null }
export function SopRegister({ rows, canManage }: Base & { rows: SopRow[] }) {
  return (
    <RegisterScreen<SopRow>
      basePath="/knowledge?view=sops" canManage={canManage} rows={rows}
      addLabel="Write an SOP"
      emptyText="No SOPs yet. Start with the three things that go wrong when the person who normally does them is away."
      onCreate={(v) => createSop(v)}
      tiles={[
        { label: 'SOPs', value: String(rows.length) },
        { label: 'Published', value: String(rows.filter((r) => r.status === 'PUBLISHED').length) },
        { label: 'Draft', value: String(rows.filter((r) => r.status === 'DRAFT').length) },
      ]}
      columns={[
        { label: 'SOP', render: (r) => r.title },
        { label: 'Department', render: (r) => r.department ?? '—' },
        { label: 'Version', render: (r) => `v${r.version}` },
        { label: 'Effective', render: (r) => fmt(r.effectiveOn) },
        { label: 'Status', render: (r) => r.status.toLowerCase() },
      ]}
      fields={[
        { name: 'title', label: 'SOP', required: true, placeholder: 'Releasing a unit from hold' },
        { name: 'department', label: 'Department' },
        { name: 'effectiveOn', label: 'Effective from', type: 'date' },
        { name: 'status', label: 'Status', type: 'select', options: opt(['DRAFT', 'PUBLISHED', 'RETIRED']) },
        { name: 'content', label: 'The procedure', type: 'textarea' },
      ]}
    />
  );
}

export interface LessonRow { id: string; title: string; category: string | null; situation: string | null; recommendation: string; capturedOn: Date }
export function LessonsRegister({ rows, projects, projectId, canManage }: Base & { rows: LessonRow[] }) {
  return (
    <RegisterScreen<LessonRow>
      basePath="/knowledge?view=lessons" projects={projects} projectId={projectId} canManage={canManage} rows={rows}
      addLabel="Capture a lesson"
      emptyText="Nothing captured yet. The point of a lessons register is that the next project does not pay for this one's mistakes twice."
      onCreate={(v) => createLesson({ ...v, projectId: projectId ?? '' })}
      tiles={[{ label: 'Lessons', value: String(rows.length) }]}
      columns={[
        { label: 'Lesson', render: (r) => r.title },
        { label: 'Category', render: (r) => r.category ?? '—' },
        { label: 'Do differently', render: (r) => <span className="text-xs text-muted-foreground">{r.recommendation.slice(0, 140)}</span> },
        { label: 'Captured', render: (r) => fmt(r.capturedOn) },
      ]}
      fields={[
        { name: 'title', label: 'Lesson', required: true },
        { name: 'category', label: 'Category', placeholder: 'procurement, design, approvals…' },
        { name: 'situation', label: 'What happened', type: 'textarea' },
        { name: 'recommendation', label: 'What to do differently', type: 'textarea', required: true },
      ]}
    />
  );
}

// ── ESG ──────────────────────────────────────────────────────────────────────

export interface ManifestRow { id: string; manifestNo: string | null; wasteType: string; quantity: number; unit: string | null; disposedTo: string | null; disposedOn: Date | null }
export function WasteRegister({ rows, projects, projectId, canManage }: Base & { rows: ManifestRow[] }) {
  return (
    <RegisterScreen<ManifestRow>
      basePath="/esg?view=waste" projects={projects} projectId={projectId} canManage={canManage} rows={rows}
      addLabel="Record a manifest"
      emptyText="No manifests recorded. C&D waste has to go to an authorised facility, and the manifest is what proves it did."
      onCreate={(v) => createWasteManifest({ ...v, projectId: projectId ?? '' })}
      tiles={[
        { label: 'Manifests', value: String(rows.length) },
        { label: 'Total quantity', value: rows.reduce((t, r) => t + r.quantity, 0).toLocaleString('en-IN') },
      ]}
      columns={[
        { label: 'Manifest', render: (r) => r.manifestNo ?? '—' },
        { label: 'Waste', render: (r) => r.wasteType },
        { label: 'Quantity', render: (r) => `${r.quantity.toLocaleString('en-IN')} ${r.unit ?? ''}`.trim() },
        { label: 'Disposed to', render: (r) => r.disposedTo ?? '—' },
        { label: 'On', render: (r) => fmt(r.disposedOn) },
      ]}
      fields={[
        { name: 'wasteType', label: 'Waste type', required: true, placeholder: 'C&D debris, scrap steel, hazardous…' },
        { name: 'manifestNo', label: 'Manifest number' },
        { name: 'quantity', label: 'Quantity', type: 'number' },
        { name: 'unit', label: 'Unit', placeholder: 'MT, cum, trips' },
        { name: 'disposedTo', label: 'Disposed to', placeholder: 'Authorised facility / recycler' },
        { name: 'disposedOn', label: 'Disposed on', type: 'date' },
      ]}
    />
  );
}

// ── Security ops ─────────────────────────────────────────────────────────────

export interface AccessReviewRow { id: string; subject: string; scope: string | null; reviewer: string | null; dueOn: Date | null; completedOn: Date | null; findings: string | null }
export function AccessReviewRegister({ rows, canManage }: Base & { rows: AccessReviewRow[] }) {
  const open = rows.filter((r) => !r.completedOn).length;
  return (
    <RegisterScreen<AccessReviewRow>
      basePath="/security-ops?view=access" canManage={canManage} rows={rows}
      addLabel="Schedule a review"
      emptyText="No access reviews on record. Who still has access they no longer need is a question best asked on a schedule, not after an incident."
      onCreate={(v) => createAccessReview(v)}
      tiles={[
        { label: 'Reviews', value: String(rows.length) },
        { label: 'Outstanding', value: String(open), tone: open > 0 ? 'bad' : 'good' },
      ]}
      columns={[
        { label: 'Subject', render: (r) => r.subject },
        { label: 'Scope', render: (r) => r.scope ?? '—' },
        { label: 'Reviewer', render: (r) => r.reviewer ?? '—' },
        { label: 'Due', render: (r) => <Due on={r.dueOn} /> },
        { label: 'Completed', render: (r) => fmt(r.completedOn) },
      ]}
      fields={[
        { name: 'subject', label: 'What is being reviewed', required: true, placeholder: 'Finance team CRM permissions' },
        { name: 'scope', label: 'Scope', placeholder: 'roles, exports, admin rights…' },
        { name: 'reviewer', label: 'Reviewer' },
        { name: 'dueOn', label: 'Due', type: 'date' },
        { name: 'completedOn', label: 'Completed on', type: 'date', advanced: true },
        { name: 'findings', label: 'Findings', type: 'textarea', advanced: true },
      ]}
    />
  );
}

// ── Land ─────────────────────────────────────────────────────────────────────

export interface PoaRow { id: string; grantor: string; attorney: string; scope: string; validFrom: Date | null; validUntil: Date | null; revoked: boolean; parcelName: string | null }
export function PoaRegister({ rows, projects, projectId, canManage }: Base & { rows: PoaRow[] }) {
  const live = rows.filter((r) => !r.revoked).length;
  return (
    <RegisterScreen<PoaRow>
      basePath="/land?view=poa" projects={projects} projectId={projectId} canManage={canManage} rows={rows}
      addLabel="Record a POA"
      emptyText="No powers of attorney recorded. Every GPA and SPA in the title chain belongs here — with its scope and its expiry."
      onCreate={(v) => createPowerOfAttorney({ ...v, projectId: projectId ?? '' })}
      tiles={[
        { label: 'Recorded', value: String(rows.length) },
        { label: 'In force', value: String(live) },
        { label: 'Revoked', value: String(rows.length - live) },
      ]}
      columns={[
        { label: 'Grantor', render: (r) => r.grantor },
        { label: 'Attorney', render: (r) => r.attorney },
        { label: 'Parcel', render: (r) => r.parcelName ?? '—' },
        { label: 'Scope', render: (r) => <span className="text-xs text-muted-foreground">{r.scope.slice(0, 100)}</span> },
        { label: 'Valid until', render: (r) => <Due on={r.validUntil} /> },
        { label: 'Status', render: (r) => (r.revoked ? 'revoked' : 'in force') },
      ]}
      fields={[
        { name: 'grantor', label: 'Grantor', required: true },
        { name: 'attorney', label: 'Attorney', required: true },
        { name: 'scope', label: 'What it covers', type: 'textarea', required: true, hint: 'Be specific. An unbounded power of attorney is the one nobody should sign.' },
        { name: 'parcelId', label: 'Land parcel ID', advanced: true },
        { name: 'validFrom', label: 'Valid from', type: 'date' },
        { name: 'validUntil', label: 'Valid until', type: 'date' },
        { name: 'revoked', label: 'Revoked?', type: 'select', options: [{ value: 'NO', label: 'in force' }, { value: 'YES', label: 'revoked' }] },
      ]}
    />
  );
}

export interface JdaRow { id: string; parcelId: string; parcelName: string | null; landownerName: string; shareType: string; developerShare: number | null; landownerShare: number | null; refundableDeposit: number | null; signedOn: Date | null }
export function JdaRegister({ rows, canManage, parcels }: Base & { rows: JdaRow[]; parcels: { id: string; name: string }[] }) {
  return (
    <RegisterScreen<JdaRow>
      basePath="/land?view=jda" canManage={canManage} rows={rows}
      addLabel="Record a JDA"
      emptyText="No joint development agreements recorded. The share split, the deposit and the signing date are the three numbers everything downstream depends on."
      onCreate={(v) => createJda(v)}
      tiles={[
        { label: 'Agreements', value: String(rows.length) },
        { label: 'Deposits committed', value: formatCurrency(rows.reduce((t, r) => t + (r.refundableDeposit ?? 0), 0)) },
      ]}
      columns={[
        { label: 'Parcel', render: (r) => r.parcelName ?? r.parcelId },
        { label: 'Landowner', render: (r) => r.landownerName },
        { label: 'Basis', render: (r) => r.shareType.replace(/_/g, ' ').toLowerCase() },
        { label: 'Developer', render: (r) => (r.developerShare == null ? '—' : `${r.developerShare}%`) },
        { label: 'Landowner', render: (r) => (r.landownerShare == null ? '—' : `${r.landownerShare}%`) },
        { label: 'Deposit', render: (r) => formatCurrency(r.refundableDeposit) },
        { label: 'Signed', render: (r) => fmt(r.signedOn) },
      ]}
      fields={[
        { name: 'parcelId', label: 'Land parcel', type: 'select', required: true, options: parcels.map((p) => ({ value: p.id, label: p.name })) },
        { name: 'landownerName', label: 'Landowner', required: true },
        { name: 'shareType', label: 'Share basis', type: 'select', options: opt(['AREA_SHARE', 'REVENUE_SHARE', 'HYBRID']) },
        { name: 'developerShare', label: 'Developer share %', type: 'number' },
        { name: 'landownerShare', label: 'Landowner share %', type: 'number', hint: 'The two must add up to 100.' },
        { name: 'refundableDeposit', label: 'Refundable deposit', type: 'currency' },
        { name: 'signedOn', label: 'Signed on', type: 'date' },
        { name: 'obligations', label: 'Obligations', type: 'textarea', advanced: true },
      ]}
    />
  );
}

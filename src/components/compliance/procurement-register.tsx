'use client';
import { RegisterScreen } from '@/components/common/register-screen';
import { createGoodsReceipt } from '@/server/actions/compliance';
interface Row { id: string; vendorName: string; materialName: string; poReference: string | null; unit: string | null; orderedQty: number; receivedQty: number; billedQty: number; matchStatus: string; matchDetail: string; clean: boolean; receivedOn: Date; }
function Badge({ status, clean }: { status: string; clean: boolean }) {
  return <span className={clean ? 'rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600' : 'rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive'}>{status.replace(/_/g, ' ').toLowerCase()}</span>;
}
export function ProcurementRegister({ canManage, projects, projectId, rows }: { canManage: boolean; projects: Array<{ id: string; name: string }>; projectId: string | null; rows: Row[] }) {
  const bad = rows.filter((r) => !r.clean).length;
  return (
    <RegisterScreen<Row>
      basePath="/procurement" projects={projects} projectId={projectId} canManage={canManage} rows={rows}
      addLabel="Record goods received" emptyText="No goods receipts yet. Record what was ordered, received and billed to catch paying for material that never arrived."
      onCreate={(v) => createGoodsReceipt({ ...v, projectId: projectId ?? '' })}
      tiles={[{ label: 'Receipts', value: String(rows.length) }, { label: 'Discrepancies', value: String(bad), tone: bad > 0 ? 'bad' : 'good', sub: 'need review' }, { label: 'Clean', value: String(rows.length - bad) }]}
      columns={[{ label: 'Vendor', render: (r) => r.vendorName }, { label: 'Material', render: (r) => r.materialName }, { label: 'Ordered', render: (r) => `${r.orderedQty}${r.unit ? ' ' + r.unit : ''}` }, { label: 'Received', render: (r) => String(r.receivedQty) }, { label: 'Billed', render: (r) => String(r.billedQty) }, { label: 'Match', render: (r) => <Badge status={r.matchStatus} clean={r.clean} /> }, { label: 'Detail', render: (r) => <span className="text-xs text-muted-foreground">{r.matchDetail || 'ok'}</span> }]}
      fields={[{ name: 'vendorName', label: 'Vendor', required: true }, { name: 'materialName', label: 'Material', required: true }, { name: 'poReference', label: 'PO reference' }, { name: 'unit', label: 'Unit', placeholder: 'bags, cft, nos' }, { name: 'orderedQty', label: 'Ordered qty', type: 'number' }, { name: 'receivedQty', label: 'Received qty', type: 'number' }, { name: 'billedQty', label: 'Billed qty', type: 'number' }]}
    />
  );
}

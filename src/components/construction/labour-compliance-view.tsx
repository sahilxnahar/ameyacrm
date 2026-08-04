'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { ShieldCheck, ShieldAlert, Check, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Monogram } from '@/components/shared/record-row';
import { setVendorLabourCompliance, recordComplianceDoc, verifyComplianceDoc } from '@/server/actions/labour-compliance';

type DocState = { id: string | null; status: string; challanNo: string | null };
interface LabourVendor { id: string; name: string; epf: DocState; esi: DocState }
type Vendor = { id: string; name: string; requiresLabourCompliance: boolean };

const STATUS_TONE: Record<string, 'success' | 'warning' | 'secondary' | 'destructive'> = {
  VERIFIED: 'success', UPLOADED: 'warning', PENDING: 'warning', MISSING: 'destructive',
};

export function LabourComplianceView({ month, allVendors, labourVendors }: { month: string; allVendors: Vendor[]; labourVendors: LabourVendor[] }) {
  // Kept, not discarded — verifying a challan twice double-writes the record.
  const [pending, start] = React.useTransition();
  const [addOpen, setAddOpen] = React.useState(false);

  const act = (msg: string, fn: () => Promise<{ ok: true } | { error: string }>) => start(async () => {
    const r = await fn(); if ('error' in r) { toast.error(r.error); return; } toast.success(msg); location.reload();
  });

  function record(vendorId: string, kind: 'EPF' | 'ESI', challanNo: string, verify: boolean) {
    if (!challanNo.trim() && !verify) { toast.error('Enter the challan number.'); return; }
    act(`${kind} recorded`, () => recordComplianceDoc({ vendorId, kind, periodMonth: month, challanNo: challanNo.trim() || undefined, verified: verify }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{labourVendors.length} labour vendor(s) gated · month {month}</div>
        <Button variant="outline" size="sm" onClick={() => setAddOpen((v) => !v)} className="gap-1"><Plus className="h-4 w-4" /> Flag labour vendors</Button>
      </div>

      {addOpen && (
        <Card className="p-4">
          <div className="mb-2 text-sm font-medium">Which vendors are labour vendors? (their payments get gated on EPF/ESI)</div>
          <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
            {allVendors.map((v) => (
              <label key={v.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                <input type="checkbox" defaultChecked={v.requiresLabourCompliance} className="h-4 w-4"
                  onChange={(e) => act(e.target.checked ? `${v.name} gated` : `${v.name} ungated`, () => setVendorLabourCompliance(v.id, e.target.checked))} />
                <span className="truncate">{v.name}</span>
              </label>
            ))}
          </div>
        </Card>
      )}

      {labourVendors.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No labour vendors flagged yet. Use “Flag labour vendors” above.</p>
      ) : (
        <div className="space-y-3">
          {labourVendors.map((v) => {
            const blocked = v.epf.status !== 'VERIFIED' || v.esi.status !== 'VERIFIED';
            return (
              <Card key={v.id} className="p-4">
                <div className="mb-3 flex items-center gap-3">
                  <Monogram name={v.name} />
                  <div className="flex-1 font-medium">{v.name}</div>
                  {blocked
                    ? <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" /> Payments blocked</Badge>
                    : <Badge variant="success" className="gap-1"><ShieldCheck className="h-3 w-3" /> Cleared</Badge>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['EPF', 'ESI'] as const).map((kind) => {
                    const d = kind === 'EPF' ? v.epf : v.esi;
                    return <ChallanRow key={kind} kind={kind} state={d} pending={pending} onRecord={(ch, ver) => record(v.id, kind, ch, ver)}
                      onVerify={() => d.id && act(`${kind} verified`, () => verifyComplianceDoc(d.id!))} />;
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChallanRow({ kind, state, onRecord, onVerify, pending }: { kind: string; state: DocState; onRecord: (ch: string, verify: boolean) => void; onVerify: () => void; pending: boolean }) {
  const [ch, setCh] = React.useState(state.challanNo ?? '');
  return (
    <div className="rounded-md border p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium">{kind} challan</span>
        <Badge variant={STATUS_TONE[state.status]}>{state.status === 'MISSING' ? 'Not recorded' : state.status.charAt(0) + state.status.slice(1).toLowerCase()}</Badge>
      </div>
      <div className="flex gap-1.5">
        <Input value={ch} onChange={(e) => setCh(e.target.value)} placeholder="Challan no." className="h-8 text-sm" />
        {state.status === 'VERIFIED' ? null : state.id ? (
          <Button size="sm" disabled={pending} onClick={onVerify} className="gap-1"><Check className="h-3.5 w-3.5" /> Verify</Button>
        ) : (
          <>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => onRecord(ch, false)}>Save</Button>
            <Button size="sm" disabled={pending} onClick={() => onRecord(ch, true)} className="gap-1"><Check className="h-3.5 w-3.5" /> Verify</Button>
          </>
        )}
      </div>
    </div>
  );
}

'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { GROUP_NAMES, VOUCHER_TYPES, VOUCHER_KEY, natureOfGroup, type VoucherType } from '@/config/tally-groups';
import { createTallyLedger, createTallyVoucher, deleteTallyVoucher, deleteTallyLedger, createTallyStockItem, createTallyItemInvoice, deleteTallyStockItem, tallyStatementPdf, tallyLedgerStatement, tallyOutstanding, tallyDataForPeriod, createTallyCostCentre, tallyCostCentreReport, tallyBankRecon, tallySetCleared, tallyVoucherForEdit, updateTallyVoucher, updateTallyVoucherHeader, tallyGstReturns, tallyFlows, tallyRatios, saveTallyPrefs, tallyInvoicePdf, tallyScheduleIII, type LedgerStmt, type Outstanding, type AgedParty, type CostReport, type BankRecon, type GstReturns, type GstRateRow, type FlowStatements, type FlowRow, type Ratios, type ScheduleIII } from '@/server/actions/tally';
import { exportXlsx } from '@/lib/export/xlsx';
import type { TallyData } from '@/server/services/tally-service';
import { DEFAULT_TALLY_PREFS, type TallyPrefs } from '@/lib/tally/prefs';

type StmtKind = 'trial' | 'pl' | 'bs' | 'stock';

type Screen = 'gateway' | 'voucher' | 'invoice' | 'daybook' | 'trial' | 'pl' | 'balsheet' | 'ledgers' | 'createLedger' | 'stock' | 'createStock' | 'stockSummary' | 'ledgerStmt' | 'outstanding' | 'costCentres' | 'jobCosting' | 'bankRecon' | 'editHeader' | 'gst' | 'flows' | 'ratios' | 'shortcuts' | 'settings' | 'schedule3';
const inr = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);

interface Line { ledgerId: string; debit: string; credit: string }

export function TallyApp({ data: initialData, prefs = DEFAULT_TALLY_PREFS }: { data: TallyData; prefs?: TallyPrefs }) {
  const router = useRouter();
  const [data, setData] = React.useState<TallyData>(initialData);
  React.useEffect(() => setData(initialData), [initialData]);
  const [screen, setScreen] = React.useState<Screen>('gateway');
  const [pending, start] = React.useTransition();

  // Desktop-only: Ameya Tally is keyboard-driven and needs a real keyboard and
  // screen width. On phones we show a friendly note instead of the cramped app.
  const [tooSmall, setTooSmall] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setTooSmall(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const applyPeriod = (from: Date | null, to: Date | null, label: string) => start(async () => {
    const r = await tallyDataForPeriod(from ? from.toISOString() : null, to ? to.toISOString() : null, label);
    if ('error' in r) { toast.error(r.error); return; }
    setData(r.data);
  });

  // Apply the user's preferred default period once on open.
  const appliedDefault = React.useRef(false);
  React.useEffect(() => {
    if (appliedDefault.current || prefs.defaultPeriod === 'all') return;
    appliedDefault.current = true;
    const now = new Date();
    if (prefs.defaultPeriod === 'month') {
      applyPeriod(new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0), now.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }));
    } else if (prefs.defaultPeriod === 'quarter') {
      const q = Math.floor(now.getMonth() / 3); const fyY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      applyPeriod(new Date(now.getFullYear(), q * 3, 1), new Date(now.getFullYear(), q * 3 + 3, 0), `Q${q + 1} FY${String(fyY).slice(2)}`);
    } else if (prefs.defaultPeriod === 'fy') {
      const fyY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      applyPeriod(new Date(fyY, 3, 1), new Date(fyY + 1, 2, 31), `FY ${fyY}-${String(fyY + 1).slice(2)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Voucher entry state
  const [vType, setVType] = React.useState<VoucherType>((prefs.defaultVoucher as VoucherType) ?? 'Payment');
  const [vDate, setVDate] = React.useState(todayISO());
  const [vNarr, setVNarr] = React.useState('');
  const [lines, setLines] = React.useState<Line[]>([{ ledgerId: '', debit: '', credit: '' }, { ledgerId: '', debit: '', credit: '' }]);

  const [cfrom, setCfrom] = React.useState('');
  const [cto, setCto] = React.useState('');
  const [vCostCentre, setVCostCentre] = React.useState('');
  const [costReport, setCostReport] = React.useState<CostReport | null>(null);
  const [recon, setRecon] = React.useState<BankRecon | null>(null);
  const [reconLedgerId, setReconLedgerId] = React.useState('');
  const [editId, setEditId] = React.useState<string | null>(null);
  const [gst, setGst] = React.useState<GstReturns | null>(null);
  const [flows, setFlows] = React.useState<FlowStatements | null>(null);
  const [ratios, setRatios] = React.useState<Ratios | null>(null);
  const [sch3, setSch3] = React.useState<ScheduleIII | null>(null);

  // Item-invoice (Sales/Purchase) state
  const [invType, setInvType] = React.useState<'Sales' | 'Purchase'>('Sales');
  const [invParty, setInvParty] = React.useState('');
  const [invItems, setInvItems] = React.useState<Array<{ itemId: string; qty: string; rate: string }>>([{ itemId: '', qty: '', rate: '' }]);

  const back = () => setScreen('gateway');

  const openVoucher = (t: VoucherType) => {
    setEditId(null); setVCostCentre('');
    if (t === 'Sales' || t === 'Purchase') {
      setInvType(t); setVDate(todayISO()); setVNarr(''); setInvParty(''); setInvItems([{ itemId: '', qty: '', rate: '' }]);
      setScreen('invoice');
      return;
    }
    setVType(t); setVDate(todayISO()); setVNarr(''); setLines([{ ledgerId: '', debit: '', credit: '' }, { ledgerId: '', debit: '', credit: '' }]); setScreen('voucher');
  };

  const openEditVoucher = (id: string) => start(async () => {
    const r = await tallyVoucherForEdit(id);
    if ('error' in r) { toast.error(r.error); return; }
    setEditId(r.id); setVDate(r.date); setVNarr(r.narration ?? ''); setVCostCentre(r.costCentre ?? '');
    if (r.isInvoice) { setScreen('editHeader'); return; }
    setVType(r.type as VoucherType);
    setLines(r.lines.map((l) => ({ ledgerId: l.ledgerId, debit: l.debit ? String(l.debit) : '', credit: l.credit ? String(l.credit) : '' })));
    setScreen('voucher');
  });
  const saveHeaderEdit = () => {
    if (!editId) return;
    start(async () => {
      const r = await updateTallyVoucherHeader({ id: editId, date: vDate, narration: vNarr || undefined, costCentre: vCostCentre || undefined });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Voucher updated'); setEditId(null); router.refresh(); back();
    });
  };

  // Global keyboard: Esc = back; F4–F9 open a voucher from anywhere.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (screen !== 'gateway') { e.preventDefault(); back(); } return; }
      const vk = (Object.entries(VOUCHER_KEY) as Array<[VoucherType, string]>).find(([, k]) => k === e.key);
      if (vk) { e.preventDefault(); openVoucher(vk[0]); return; }
      if (screen === 'gateway') {
        if (e.key.toLowerCase() === 'o') { e.preventDefault(); openOutstanding(); return; }
        if (e.key.toLowerCase() === 'j') { e.preventDefault(); openJobCosting(); return; }
        if (e.key.toLowerCase() === 'r') { e.preventDefault(); setReconLedgerId(''); setRecon(null); setScreen('bankRecon'); return; }
        if (e.key.toLowerCase() === 'g') { e.preventDefault(); openGst(); return; }
        if (e.key.toLowerCase() === 'f') { e.preventDefault(); openFlows(); return; }
        if (e.key.toLowerCase() === 'a') { e.preventDefault(); openRatios(); return; }
        if (e.key === '?') { e.preventDefault(); setScreen('shortcuts'); return; }
        if (e.key === '3') { e.preventDefault(); openSchedule3(); return; }
        const map: Record<string, Screen> = { v: 'voucher', d: 'daybook', t: 'trial', b: 'balsheet', p: 'pl', l: 'ledgers', i: 'stock', s: 'stockSummary', c: 'costCentres' };
        const s = map[e.key.toLowerCase()];
        if (s) { e.preventDefault(); if (s === 'voucher') openVoucher('Payment'); else setScreen(s); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen]);

  const totalDr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const diff = Math.round((totalDr - totalCr) * 100) / 100;
  const balanced = diff === 0 && totalDr > 0;

  const saveVoucher = () => {
    if (!balanced) { toast.error(diff !== 0 ? `Out of balance by ₹${inr(Math.abs(diff))}` : 'Enter amounts on both sides'); return; }
    const payloadLines = lines.filter((l) => l.ledgerId && (Number(l.debit) || Number(l.credit))).map((l) => ({ ledgerId: l.ledgerId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }));
    start(async () => {
      const r = editId
        ? await updateTallyVoucher({ id: editId, date: vDate, narration: vNarr || undefined, costCentre: vCostCentre || undefined, lines: payloadLines })
        : await createTallyVoucher({ type: vType, date: vDate, narration: vNarr || undefined, costCentre: vCostCentre || undefined, lines: payloadLines });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(editId ? `${vType} voucher updated` : `${vType} voucher posted`); setEditId(null); router.refresh(); back();
    });
  };

  const removeVoucher = (id: string) => start(async () => {
    const r = await deleteTallyVoucher(id);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Voucher deleted'); router.refresh();
  });

  const printInvoice = (id: string) => start(async () => {
    const r = await tallyInvoicePdf(id);
    if ('error' in r) { toast.error(r.error); return; }
    const a = document.createElement('a'); a.href = `data:application/pdf;base64,${r.pdfBase64}`; a.download = r.filename; a.click();
    toast.success('Invoice PDF downloaded');
  });

  const stockById = new Map(data.stock.map((s) => [s.id, s]));
  const invTaxable = invItems.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0);
  const invGst = invItems.reduce((s, l) => { const it = stockById.get(l.itemId); const amt = (Number(l.qty) || 0) * (Number(l.rate) || 0); return s + amt * ((it?.gstRate ?? 0) / 100); }, 0);
  const invTotal = Math.round((invTaxable + invGst) * 100) / 100;

  const saveInvoice = () => {
    if (!invParty) { toast.error('Choose the party ledger'); return; }
    const rows = invItems.filter((l) => l.itemId && Number(l.qty) > 0);
    if (!rows.length) { toast.error('Add at least one item with a quantity'); return; }
    start(async () => {
      const r = await createTallyItemInvoice({ type: invType, date: vDate, partyLedgerId: invParty, narration: vNarr || undefined, costCentre: vCostCentre || undefined, items: rows.map((l) => ({ itemId: l.itemId, qty: Number(l.qty), rate: Number(l.rate) || 0 })) });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`${invType} invoice posted`); router.refresh(); back();
    });
  };
  const removeStock = (id: string) => start(async () => {
    const r = await deleteTallyStockItem(id);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Stock item deleted'); router.refresh();
  });

  const exportPdf = (kind: StmtKind) => start(async () => {
    const r = await tallyStatementPdf(kind, data.period.from, data.period.to, data.period.label);
    if ('error' in r) { toast.error(r.error); return; }
    const a = document.createElement('a'); a.href = `data:application/pdf;base64,${r.pdfBase64}`; a.download = r.filename; a.click();
    toast.success('PDF downloaded');
  });
  const exportExcel = (kind: StmtKind) => {
    if (kind === 'trial') exportXlsx('Tally-Trial-Balance', 'Trial Balance', data.trial.rows.map((r) => ({ Ledger: r.name, Group: r.group, Debit: r.debit, Credit: r.credit })));
    else if (kind === 'stock') exportXlsx('Tally-Stock-Summary', 'Stock Summary', data.stock.map((s) => ({ Item: s.name, Unit: s.unit, Inward: s.inQty, Outward: s.outQty, Closing: s.closingQty, Rate: s.rate, Value: s.value })));
    else if (kind === 'pl') exportXlsx('Tally-Profit-and-Loss', 'P&L', [...data.pl.income.map((l) => ({ Section: 'Income', Ledger: l.name, Amount: l.amount })), ...data.pl.expense.map((l) => ({ Section: 'Expense', Ledger: l.name, Amount: l.amount }))]);
    else exportXlsx('Tally-Balance-Sheet', 'Balance Sheet', data.ledgers.filter((l) => (l.nature === 'ASSET' || l.nature === 'LIABILITY') && l.balance !== 0).map((l) => ({ Section: l.nature === 'ASSET' ? 'Asset' : 'Liability', Ledger: l.name, Amount: l.balance })));
    toast.success('Excel downloaded');
  };

  const [stmt, setStmt] = React.useState<LedgerStmt | null>(null);
  const [outstanding, setOutstanding] = React.useState<Outstanding | null>(null);
  const openLedger = (id: string) => start(async () => {
    const r = await tallyLedgerStatement(id);
    if ('error' in r) { toast.error(r.error); return; }
    setStmt(r); setScreen('ledgerStmt');
  });
  const openOutstanding = () => start(async () => {
    const r = await tallyOutstanding();
    if ('error' in r) { toast.error(r.error); return; }
    setOutstanding(r); setScreen('outstanding');
  });
  const openJobCosting = () => start(async () => {
    const r = await tallyCostCentreReport(data.period.from, data.period.to);
    if ('error' in r) { toast.error(r.error); return; }
    setCostReport(r); setScreen('jobCosting');
  });
  const openGst = () => start(async () => {
    const r = await tallyGstReturns(data.period.from, data.period.to);
    if ('error' in r) { toast.error(r.error); return; }
    setGst(r); setScreen('gst');
  });
  const openFlows = () => start(async () => {
    const r = await tallyFlows(data.period.from, data.period.to);
    if ('error' in r) { toast.error(r.error); return; }
    setFlows(r); setScreen('flows');
  });
  const openRatios = () => start(async () => {
    const r = await tallyRatios(data.period.from, data.period.to, data.period.label);
    if ('error' in r) { toast.error(r.error); return; }
    setRatios(r); setScreen('ratios');
  });
  const openSchedule3 = () => start(async () => {
    const r = await tallyScheduleIII(data.period.from, data.period.to, data.period.label);
    if ('error' in r) { toast.error(r.error); return; }
    setSch3(r); setScreen('schedule3');
  });
  const addCostCentre = (name: string) => start(async () => {
    const r = await createTallyCostCentre(name);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Cost centre created'); router.refresh();
  });
  const openBankRecon = (ledgerId: string) => { setReconLedgerId(ledgerId); if (!ledgerId) { setRecon(null); return; } start(async () => {
    const r = await tallyBankRecon(ledgerId);
    if ('error' in r) { toast.error(r.error); return; }
    setRecon(r);
  }); };
  const setCleared = (lineId: string, dateISO: string | null) => start(async () => {
    const r = await tallySetCleared(lineId, dateISO);
    if ('error' in r) { toast.error(r.error); return; }
    const rr = await tallyBankRecon(reconLedgerId);
    if (!('error' in rr)) setRecon(rr);
    router.refresh();
  });
  const idByName = new Map(data.ledgers.map((l) => [l.name, l.id]));

  if (tooSmall) {
    return (
      <div className="mx-auto max-w-md rounded-lg border-2 border-[#1B2A4A] bg-[#dfe6ee] p-6 text-center font-mono text-[#0f2038]">
        <div className="mb-3 inline-block rounded bg-[#1B2A4A] px-3 py-1 text-sm font-semibold tracking-wide text-[#E9D9A8]">AMEYA TALLY</div>
        <p className="mb-2 text-lg font-bold text-[#1B2A4A]">Please use a desktop for Tally</p>
        <p className="text-sm text-[#5B4412]">Ameya Tally is a keyboard-driven accounting workspace — the function keys (F4–F9), the day book and the reports all need a proper keyboard and a wider screen. Open the CRM on a laptop or desktop to use it.</p>
        <p className="mt-3 text-xs text-[#5B4412]">The rest of the CRM works fine here on your phone — it’s only Tally that asks for a computer.</p>
      </div>
    );
  }

  return (
    <div className="tally-wrap min-h-[calc(100vh-9rem)] overflow-hidden rounded-lg border-2 border-[#0f2038] font-mono text-[13px] text-[#0f2038]" style={{ background: '#dfe6ee' }}>
      {/* Title bar */}
      <div className="flex items-center justify-between bg-[#1B2A4A] px-3 py-1.5 text-[#E9D9A8]">
        <span className="font-semibold tracking-wide">AMEYA TALLY</span>
        <span className="text-xs">{prefs.companyName} · {data.totals.ledgers} ledgers · {data.totals.vouchers} vouchers</span>
        <span className="text-xs">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
      </div>

      {/* Period bar */}
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-[#0f2038] bg-[#c9d4e0] px-3 py-1.5 text-[11px]">
        <span className="font-semibold text-[#5B4412]">Period:</span>
        {(() => {
          const now = new Date();
          const mStart = new Date(now.getFullYear(), now.getMonth(), 1), mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          const q = Math.floor(now.getMonth() / 3); const qStart = new Date(now.getFullYear(), q * 3, 1), qEnd = new Date(now.getFullYear(), q * 3 + 3, 0);
          const fyY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; const fyStart = new Date(fyY, 3, 1), fyEnd = new Date(fyY + 1, 2, 31);
          const presets: Array<[string, () => void]> = [
            ['This Month', () => applyPeriod(mStart, mEnd, mStart.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }))],
            ['This Quarter', () => applyPeriod(qStart, qEnd, `Q${q + 1} FY${String(fyY).slice(2)}`)],
            ['This FY', () => applyPeriod(fyStart, fyEnd, `FY ${fyY}-${String(fyY + 1).slice(2)}`)],
            ['All time', () => applyPeriod(null, null, 'All time')],
          ];
          return presets.map(([label, fn]) => (
            <button key={label} onClick={fn} className={`rounded px-2 py-0.5 ${data.period.label === label ? 'bg-[#1B2A4A] text-white' : 'bg-white/70 hover:bg-white'}`}>{label}</button>
          ));
        })()}
        <span className="mx-1 text-[#5B4412]">|</span>
        <input type="date" value={cfrom} onChange={(e) => setCfrom(e.target.value)} className="border border-[#0f2038]/40 bg-white px-1.5 py-0.5" />
        <span>to</span>
        <input type="date" value={cto} onChange={(e) => setCto(e.target.value)} className="border border-[#0f2038]/40 bg-white px-1.5 py-0.5" />
        <button onClick={() => { if (!cfrom && !cto) return; applyPeriod(cfrom ? new Date(cfrom) : null, cto ? new Date(cto + 'T23:59:59') : null, `${cfrom || '…'} to ${cto || '…'}`); }} className="rounded bg-[#1B2A4A] px-2 py-0.5 text-white">Apply</button>
        <span className="ml-auto font-semibold text-[#1B2A4A]">Showing: {data.period.label}{pending ? ' …' : ''}</span>
      </div>

      <div className="flex">
        <div className="min-h-[70vh] flex-1 p-4">
          {screen === 'gateway' && <Gateway onGo={(s) => { if (s === 'voucher') openVoucher('Payment'); else { if (s === 'bankRecon') { setReconLedgerId(''); setRecon(null); } setScreen(s); } }} onOutstanding={openOutstanding} onJobCosting={openJobCosting} onGst={openGst} onFlows={openFlows} onRatios={openRatios} onSchedule3={openSchedule3} data={data} />}
          {screen === 'voucher' && (
            <VoucherEntry
              type={vType} setType={setVType} date={vDate} setDate={setVDate} narr={vNarr} setNarr={setVNarr}
              lines={lines} setLines={setLines} ledgers={data.ledgers} totalDr={totalDr} totalCr={totalCr} diff={diff} balanced={balanced}
              costCentres={data.costCentres} costCentre={vCostCentre} setCostCentre={setVCostCentre}
              editing={!!editId} onSave={saveVoucher} onBack={back} pending={pending} openVoucher={openVoucher}
            />
          )}
          {screen === 'invoice' && (
            <ItemInvoice
              type={invType} setType={(t) => { setInvType(t); }} date={vDate} setDate={setVDate} narr={vNarr} setNarr={setVNarr}
              party={invParty} setParty={setInvParty} items={invItems} setItems={setInvItems}
              ledgers={data.ledgers} stock={data.stock} taxable={invTaxable} gst={invGst} total={invTotal}
              costCentres={data.costCentres} costCentre={vCostCentre} setCostCentre={setVCostCentre}
              onSave={saveInvoice} onBack={back} pending={pending} onNewItem={() => setScreen('createStock')}
            />
          )}
          {screen === 'stock' && <StockItems data={data} onBack={back} onCreate={() => setScreen('createStock')} onDelete={removeStock} pending={pending} />}
          {screen === 'createStock' && <CreateStock onDone={() => { router.refresh(); setScreen('stock'); }} onBack={() => setScreen('stock')} />}
          {screen === 'stockSummary' && <StockSummary data={data} onBack={back} onPdf={() => exportPdf('stock')} onExcel={() => exportExcel('stock')} />}
          {screen === 'ledgerStmt' && <LedgerStatement stmt={stmt} onBack={back} onExcel={() => { if (stmt && 'ok' in stmt) exportXlsx(`Ledger-${stmt.name.replace(/[^a-z0-9]+/gi, '-')}`, 'Ledger', stmt.rows.map((r) => ({ Date: new Date(r.date).toLocaleDateString('en-IN'), Type: r.type, No: r.number, Particulars: r.particulars, Debit: r.debit || '', Credit: r.credit || '', Balance: `${inr(r.balance)} ${r.balanceSide}` }))); }} />}
          {screen === 'outstanding' && <OutstandingView o={outstanding} onBack={back} onExcel={() => { if (outstanding && 'ok' in outstanding) { const rows = [...outstanding.receivables.map((r) => ({ Type: 'Receivable', Party: r.name, ...ageCols(r) })), ...outstanding.payables.map((r) => ({ Type: 'Payable', Party: r.name, ...ageCols(r) }))]; exportXlsx('Tally-Outstanding', 'Outstanding', rows); } }} onOpen={(name) => { const id = idByName.get(name); if (id) openLedger(id); }} />}
          {screen === 'daybook' && <DayBook data={data} onBack={back} onDelete={removeVoucher} onEdit={openEditVoucher} onInvoice={printInvoice} pending={pending} />}
          {screen === 'trial' && <TrialBalance data={data} onBack={back} onPdf={() => exportPdf('trial')} onExcel={() => exportExcel('trial')} onOpen={(name) => { const id = idByName.get(name); if (id) openLedger(id); }} />}
          {screen === 'pl' && <ProfitLoss data={data} onBack={back} onPdf={() => exportPdf('pl')} onExcel={() => exportExcel('pl')} />}
          {screen === 'balsheet' && <BalanceSheet data={data} onBack={back} onPdf={() => exportPdf('bs')} onExcel={() => exportExcel('bs')} />}
          {screen === 'ledgers' && <Ledgers data={data} onBack={back} onCreate={() => setScreen('createLedger')} onOpen={openLedger} onDelete={(id) => start(async () => { const r = await deleteTallyLedger(id); if ('error' in r) { toast.error(r.error); return; } toast.success('Ledger deleted'); router.refresh(); })} pending={pending} />}
          {screen === 'createLedger' && <CreateLedger onDone={() => { router.refresh(); setScreen('ledgers'); }} onBack={() => setScreen('ledgers')} />}
          {screen === 'costCentres' && <CostCentres data={data} onBack={back} onCreate={addCostCentre} onReport={openJobCosting} pending={pending} />}
          {screen === 'jobCosting' && <JobCosting report={costReport} label={data.period.label} onBack={back} onExcel={() => { if (costReport && 'ok' in costReport) exportXlsx('Tally-Job-Costing', 'Job Costing', costReport.rows.map((r) => ({ 'Cost Centre': r.name, Income: r.income, Expense: r.expense, Profit: r.profit }))); }} />}
          {screen === 'bankRecon' && <BankReconciliation data={data} recon={recon} ledgerId={reconLedgerId} onPick={openBankRecon} onSetCleared={setCleared} onBack={back} pending={pending} />}
          {screen === 'editHeader' && <EditHeader date={vDate} setDate={setVDate} narr={vNarr} setNarr={setVNarr} costCentres={data.costCentres} costCentre={vCostCentre} setCostCentre={setVCostCentre} onSave={saveHeaderEdit} onBack={() => { setEditId(null); setScreen('daybook'); }} pending={pending} />}
          {screen === 'gst' && <GstReturnsView gst={gst} label={data.period.label} onBack={back} onExcel={() => { if (gst && 'ok' in gst) { const rows = [...gst.gstr1.map((r) => ({ Return: 'GSTR-1 (outward)', 'Rate %': r.rate, Taxable: r.taxable, CGST: r.cgst, SGST: r.sgst, 'Total tax': r.totalTax })), ...gst.itc.map((r) => ({ Return: 'ITC (inward)', 'Rate %': r.rate, Taxable: r.taxable, CGST: r.cgst, SGST: r.sgst, 'Total tax': r.totalTax }))]; exportXlsx('Tally-GST-Returns', 'GST', rows); } }} />}
          {screen === 'flows' && <FlowsView flows={flows} label={data.period.label} onBack={back} onExcel={() => { if (flows && 'ok' in flows) { const rows = [...flows.cash.inflows.map((r) => ({ Statement: 'Cash inflow', Particulars: r.name, Group: r.group, Amount: r.amount })), ...flows.cash.outflows.map((r) => ({ Statement: 'Cash outflow', Particulars: r.name, Group: r.group, Amount: r.amount })), ...flows.funds.sources.map((r) => ({ Statement: 'Funds source', Particulars: r.name, Group: r.group, Amount: r.amount })), ...flows.funds.applications.map((r) => ({ Statement: 'Funds application', Particulars: r.name, Group: r.group, Amount: r.amount }))]; exportXlsx('Tally-Cash-Funds-Flow', 'Flows', rows); } }} />}
          {screen === 'ratios' && <RatioAnalysis ratios={ratios} onBack={back} onExcel={() => { if (ratios && 'ok' in ratios) exportXlsx('Tally-Ratio-Analysis', 'Ratios', ratios.rows.map((r) => ({ Ratio: r.name, Value: r.value, Basis: r.hint }))); }} />}
          {screen === 'schedule3' && <ScheduleThree sch={sch3} onBack={back} onExcel={() => { if (sch3 && 'ok' in sch3) { const rows = [...sch3.equityLiabilities.flatMap((s) => s.heads.map((h) => ({ Side: 'Equity & Liabilities', Section: s.title, Head: h.label, Amount: h.amount }))), ...sch3.assets.flatMap((s) => s.heads.map((h) => ({ Side: 'Assets', Section: s.title, Head: h.label, Amount: h.amount })))]; exportXlsx('Tally-Schedule-III', 'Schedule III', rows); } }} />}
          {screen === 'shortcuts' && <ShortcutsScreen os={prefs.os} onBack={back} />}
          {screen === 'settings' && <TallySettings prefs={prefs} onBack={back} onSaved={() => { router.refresh(); back(); }} />}
        </div>

        {/* Right button bar — Tally-style function keys */}
        <aside className="w-40 shrink-0 space-y-1 border-l-2 border-[#0f2038] bg-[#c9d4e0] p-2 text-[11px]">
          {VOUCHER_TYPES.map((t) => (
            <button key={t} onClick={() => openVoucher(t)} className="flex w-full items-center justify-between rounded bg-white/70 px-2 py-1 text-left hover:bg-white">
              <span>{t}</span><kbd className="text-[#8C6E2C]">{VOUCHER_KEY[t]}</kbd>
            </button>
          ))}
          <div className="pt-2 text-[10px] font-semibold text-[#5B4412]">REPORTS</div>
          <BarBtn label="Day Book" k="D" onClick={() => setScreen('daybook')} />
          <BarBtn label="Trial Balance" k="T" onClick={() => setScreen('trial')} />
          <BarBtn label="Profit & Loss" k="P" onClick={() => setScreen('pl')} />
          <BarBtn label="Balance Sheet" k="B" onClick={() => setScreen('balsheet')} />
          <BarBtn label="Stock Summary" k="S" onClick={() => setScreen('stockSummary')} />
          <BarBtn label="Outstanding" k="O" onClick={openOutstanding} />
          <BarBtn label="Job Costing" k="J" onClick={openJobCosting} />
          <BarBtn label="Bank Recon" k="R" onClick={() => { setReconLedgerId(''); setRecon(null); setScreen('bankRecon'); }} />
          <BarBtn label="GST Returns" k="G" onClick={openGst} />
          <BarBtn label="Cash / Funds Flow" k="F" onClick={openFlows} />
          <BarBtn label="Ratio Analysis" k="A" onClick={openRatios} />
          <BarBtn label="Schedule III" k="3" onClick={openSchedule3} />
          <div className="pt-2 text-[10px] font-semibold text-[#5B4412]">MASTERS</div>
          <BarBtn label="Ledgers" k="L" onClick={() => setScreen('ledgers')} />
          <BarBtn label="Stock Items" k="I" onClick={() => setScreen('stock')} />
          <BarBtn label="Cost Centres" k="C" onClick={() => setScreen('costCentres')} />
          <div className="pt-2 text-[10px] font-semibold text-[#5B4412]">HELP</div>
          <BarBtn label="Shortcuts" k="?" onClick={() => setScreen('shortcuts')} />
          <BarBtn label="Settings" k="•" onClick={() => setScreen('settings')} />
        </aside>
      </div>

      {/* Bottom hint bar */}
      <div className="flex items-center gap-4 bg-[#1B2A4A] px-3 py-1 text-[11px] text-[#E9D9A8]">
        <span><kbd>Esc</kbd> Back</span>
        <span><kbd>F4</kbd>-<kbd>F9</kbd> Vouchers</span>
        <span><kbd>D</kbd> Day Book</span>
        <span><kbd>T</kbd> Trial Balance</span>
        <span className="ml-auto">Double-entry · every voucher must balance</span>
      </div>
    </div>
  );
}

function BarBtn({ label, k, onClick }: { label: string; k: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between rounded bg-white/70 px-2 py-1 text-left hover:bg-white">
      <span>{label}</span><kbd className="text-[#8C6E2C]">{k}</kbd>
    </button>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 border-b-2 border-[#0f2038] pb-1 text-base font-bold uppercase tracking-wide text-[#1B2A4A]">{title}</h2>
      {children}
    </div>
  );
}

function Gateway({ onGo, onOutstanding, onJobCosting, onGst, onFlows, onRatios, onSchedule3, data }: { onGo: (s: Screen) => void; onOutstanding: () => void; onJobCosting: () => void; onGst: () => void; onFlows: () => void; onRatios: () => void; onSchedule3: () => void; data: TallyData }) {
  const income = data.pl.totalIncome;
  const expense = data.pl.totalExpense;
  return (
    <Panel title="Gateway of Ameya Tally">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase text-[#5B4412]">Transactions</p>
          <MenuItem label="Accounting Vouchers" k="V" onClick={() => onGo('voucher')} />
          <MenuItem label="Day Book" k="D" onClick={() => onGo('daybook')} />
          <p className="mb-1 mt-3 text-[11px] font-semibold uppercase text-[#5B4412]">Masters</p>
          <MenuItem label="Create / view Ledgers" k="L" onClick={() => onGo('ledgers')} />
          <MenuItem label="Stock Items" k="I" onClick={() => onGo('stock')} />
          <p className="mb-1 mt-3 text-[11px] font-semibold uppercase text-[#5B4412]">Reports</p>
          <MenuItem label="Trial Balance" k="T" onClick={() => onGo('trial')} />
          <MenuItem label="Profit & Loss A/c" k="P" onClick={() => onGo('pl')} />
          <MenuItem label="Balance Sheet" k="B" onClick={() => onGo('balsheet')} />
          <MenuItem label="Stock Summary" k="S" onClick={() => onGo('stockSummary')} />
          <MenuItem label="Outstanding (ageing)" k="O" onClick={onOutstanding} />
          <MenuItem label="Job Costing (P&L by centre)" k="J" onClick={onJobCosting} />
          <MenuItem label="Bank Reconciliation" k="R" onClick={() => onGo('bankRecon')} />
          <MenuItem label="GST Returns (GSTR-1 / 3B)" k="G" onClick={onGst} />
          <MenuItem label="Cash Flow & Funds Flow" k="F" onClick={onFlows} />
          <MenuItem label="Ratio Analysis" k="A" onClick={onRatios} />
          <MenuItem label="Schedule III (Balance Sheet)" k="3" onClick={onSchedule3} />
          <p className="mb-1 mt-3 text-[11px] font-semibold uppercase text-[#5B4412]">Cost Centres</p>
          <MenuItem label="Cost Centres" k="C" onClick={() => onGo('costCentres')} />
          <p className="mb-1 mt-3 text-[11px] font-semibold uppercase text-[#5B4412]">Help & setup</p>
          <MenuItem label="Keyboard shortcuts" k="?" onClick={() => onGo('shortcuts')} />
          <MenuItem label="Settings / customise" k="•" onClick={() => onGo('settings')} />
        </div>
        <div className="rounded border border-[#0f2038]/30 bg-white/50 p-3 text-[12px]">
          <p className="mb-2 font-semibold">At a glance</p>
          <Row k="Ledgers" v={String(data.totals.ledgers)} />
          <Row k="Vouchers" v={String(data.totals.vouchers)} />
          <Row k="Income (to date)" v={`₹ ${inr(income)}`} />
          <Row k="Expenses (to date)" v={`₹ ${inr(expense)}`} />
          <Row k="Net profit" v={`₹ ${inr(income - expense)}`} strong />
          <p className={`mt-2 text-[11px] ${data.trial.balanced ? 'text-emerald-700' : 'text-rose-700'}`}>
            Trial balance {data.trial.balanced ? 'is balanced ✓' : 'is OUT of balance!'}
          </p>
        </div>
      </div>
    </Panel>
  );
}

function MenuItem({ label, k, onClick }: { label: string; k: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-[#1B2A4A] hover:text-white">
      <kbd className="w-4 text-[#8C6E2C]">{k}</kbd> {label}
    </button>
  );
}
function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className={`flex justify-between border-b border-dashed border-[#0f2038]/20 py-0.5 ${strong ? 'font-bold' : ''}`}><span>{k}</span><span className="tabular-nums">{v}</span></div>;
}

function VoucherEntry(props: {
  type: VoucherType; setType: (t: VoucherType) => void; date: string; setDate: (s: string) => void; narr: string; setNarr: (s: string) => void;
  lines: Line[]; setLines: (l: Line[]) => void; ledgers: TallyData['ledgers']; totalDr: number; totalCr: number; diff: number; balanced: boolean;
  costCentres: string[]; costCentre: string; setCostCentre: (s: string) => void;
  editing?: boolean; onSave: () => void; onBack: () => void; pending: boolean; openVoucher: (t: VoucherType) => void;
}) {
  const { type, date, setDate, narr, setNarr, lines, setLines, ledgers, totalDr, totalCr, diff, balanced, costCentres, costCentre, setCostCentre, editing, onSave, onBack, pending, openVoucher } = props;
  const setLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines([...lines, { ledgerId: '', debit: '', credit: '' }]);
  const removeLine = (i: number) => setLines(lines.length > 2 ? lines.filter((_, j) => j !== i) : lines);
  const cls = 'border border-[#0f2038]/40 bg-white px-2 py-1 text-[13px]';

  return (
    <Panel title={`${editing ? 'Edit ' : ''}${type} Voucher`}>
      {!editing && (
        <div className="mb-2 flex flex-wrap gap-1">
          {VOUCHER_TYPES.map((t) => (
            <button key={t} onClick={() => openVoucher(t)} className={`rounded px-2 py-0.5 text-[11px] ${t === type ? 'bg-[#1B2A4A] text-white' : 'bg-white/70 hover:bg-white'}`}>
              {t} <kbd className="text-[#8C6E2C]">{VOUCHER_KEY[t]}</kbd>
            </button>
          ))}
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1">Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cls} /></label>
        <label className="flex flex-1 items-center gap-1">Narration <input value={narr} onChange={(e) => setNarr(e.target.value)} placeholder="Being…" className={`${cls} min-w-[12rem] flex-1`} /></label>
        {costCentres.length > 0 && (
          <label className="flex items-center gap-1">Cost centre
            <select value={costCentre} onChange={(e) => setCostCentre(e.target.value)} className={cls}>
              <option value="">— none —</option>
              {costCentres.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
      </div>

      <table className="w-full border-collapse">
        <thead><tr className="bg-[#1B2A4A] text-left text-white"><th className="p-1">Particulars (Ledger)</th><th className="w-32 p-1 text-right">Debit</th><th className="w-32 p-1 text-right">Credit</th><th className="w-8" /></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-[#0f2038]/20">
              <td className="p-1">
                <select value={l.ledgerId} onChange={(e) => setLine(i, { ledgerId: e.target.value })} className={`${cls} w-full`}>
                  <option value="">— select ledger —</option>
                  {ledgers.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.group})</option>)}
                </select>
              </td>
              <td className="p-1 text-right"><input inputMode="decimal" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: '' })} className={`${cls} w-28 text-right`} /></td>
              <td className="p-1 text-right"><input inputMode="decimal" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: '' })} className={`${cls} w-28 text-right`} /></td>
              <td className="p-1 text-center"><button onClick={() => removeLine(i)} className="text-rose-700 hover:underline" title="Remove line">✕</button></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold"><td className="p-1 text-right">Totals</td><td className="p-1 text-right tabular-nums">{inr(totalDr)}</td><td className="p-1 text-right tabular-nums">{inr(totalCr)}</td><td /></tr>
        </tfoot>
      </table>

      <div className="mt-2 flex items-center gap-3">
        <button onClick={addLine} className="rounded border border-[#0f2038]/40 bg-white/70 px-2 py-1 text-[12px] hover:bg-white">+ Add line</button>
        <span className={`text-[12px] font-semibold ${balanced ? 'text-emerald-700' : 'text-rose-700'}`}>
          {balanced ? 'Balanced ✓' : diff === 0 ? 'Enter amounts' : `Difference: ₹ ${inr(Math.abs(diff))} on ${diff > 0 ? 'Credit' : 'Debit'} side`}
        </span>
        <div className="ml-auto flex gap-2">
          <button onClick={onBack} className="rounded border border-[#0f2038]/40 px-3 py-1 text-[12px] hover:bg-white/60">Esc — Cancel</button>
          <button onClick={onSave} disabled={!balanced || pending} className="rounded bg-[#1B2A4A] px-4 py-1 text-[12px] font-semibold text-white disabled:opacity-50">Accept &amp; Save</button>
        </div>
      </div>
    </Panel>
  );
}

function DayBook({ data, onBack, onDelete, onEdit, onInvoice, pending }: { data: TallyData; onBack: () => void; onDelete: (id: string) => void; onEdit: (id: string) => void; onInvoice: (id: string) => void; pending: boolean }) {
  return (
    <Panel title="Day Book">
      <BackBtn onBack={onBack} />
      {data.vouchers.length === 0 ? <p className="text-[#5B4412]">No vouchers yet. Press F5 for a Payment or F6 for a Receipt.</p> : (
        <table className="w-full border-collapse text-[12px]">
          <thead><tr className="bg-[#1B2A4A] text-left text-white"><th className="p-1">Date</th><th className="p-1">Type</th><th className="p-1">No.</th><th className="p-1">Particulars</th><th className="p-1 text-right">Amount</th><th /></tr></thead>
          <tbody>
            {data.vouchers.map((v) => (
              <tr key={v.id} className="border-b border-[#0f2038]/20 align-top">
                <td className="whitespace-nowrap p-1">{new Date(v.date).toLocaleDateString('en-IN')}</td>
                <td className="p-1">{v.type}</td>
                <td className="p-1">{v.number}</td>
                <td className="p-1">{v.lines.map((ln, i) => <div key={i}>{ln.debit > 0 ? 'Dr ' : 'Cr '}{ln.ledger}</div>)}{v.narration && <div className="text-[#5B4412]">({v.narration})</div>}</td>
                <td className="p-1 text-right tabular-nums">{inr(v.amount)}</td>
                <td className="whitespace-nowrap p-1">{(v.type === 'Sales' || v.type === 'Purchase') && <><button onClick={() => onInvoice(v.id)} disabled={pending} className="text-[#8C6E2C] hover:underline">invoice</button> </>}<button onClick={() => onEdit(v.id)} disabled={pending} className="text-[#1B2A4A] hover:underline">edit</button> <button onClick={() => onDelete(v.id)} disabled={pending} className="text-rose-700 hover:underline">del</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function TrialBalance({ data, onBack, onPdf, onExcel, onOpen }: { data: TallyData; onBack: () => void; onPdf: () => void; onExcel: () => void; onOpen: (name: string) => void }) {
  return (
    <Panel title="Trial Balance">
      <ReportBar onBack={onBack} onPdf={onPdf} onExcel={onExcel} />
      <table className="w-full border-collapse text-[12px]">
        <thead><tr className="bg-[#1B2A4A] text-left text-white"><th className="p-1">Ledger</th><th className="p-1">Group</th><th className="p-1 text-right">Debit</th><th className="p-1 text-right">Credit</th></tr></thead>
        <tbody>
          {data.trial.rows.map((r) => (
            <tr key={r.name} className="border-b border-[#0f2038]/20"><td className="p-1"><button onClick={() => onOpen(r.name)} className="text-[#1B2A4A] underline hover:text-[#8C6E2C]">{r.name}</button></td><td className="p-1 text-[#5B4412]">{r.group}</td><td className="p-1 text-right tabular-nums">{r.debit ? inr(r.debit) : ''}</td><td className="p-1 text-right tabular-nums">{r.credit ? inr(r.credit) : ''}</td></tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t-2 border-[#0f2038] font-bold"><td className="p-1" colSpan={2}>Total</td><td className="p-1 text-right tabular-nums">{inr(data.trial.totalDebit)}</td><td className="p-1 text-right tabular-nums">{inr(data.trial.totalCredit)}</td></tr></tfoot>
      </table>
      <p className={`mt-2 text-[12px] font-semibold ${data.trial.balanced ? 'text-emerald-700' : 'text-rose-700'}`}>{data.trial.balanced ? 'Balanced ✓' : 'OUT OF BALANCE'}</p>
    </Panel>
  );
}

function ProfitLoss({ data, onBack, onPdf, onExcel }: { data: TallyData; onBack: () => void; onPdf: () => void; onExcel: () => void }) {
  const { income, expense, totalIncome: ti, totalExpense: te, profit } = data.pl;
  const inc = income.map((r) => ({ name: r.name, value: r.amount }));
  const exp = expense.map((r) => ({ name: r.name, value: r.amount }));
  return (
    <Panel title={`Profit & Loss A/c — ${data.period.label}`}>
      <ReportBar onBack={onBack} onPdf={onPdf} onExcel={onExcel} />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatementCol title="Expenses (Dr)" rows={exp} total={te} extraLabel={profit >= 0 ? 'Net Profit' : undefined} extra={profit >= 0 ? profit : undefined} />
        <StatementCol title="Income (Cr)" rows={inc} total={ti} extraLabel={profit < 0 ? 'Net Loss' : undefined} extra={profit < 0 ? -profit : undefined} />
      </div>
      <p className={`mt-3 text-center text-[13px] font-bold ${profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{profit >= 0 ? 'Net Profit' : 'Net Loss'}: ₹ {inr(Math.abs(profit))}</p>
    </Panel>
  );
}

function BalanceSheet({ data, onBack, onPdf, onExcel }: { data: TallyData; onBack: () => void; onPdf: () => void; onExcel: () => void }) {
  const assets = data.ledgers.filter((l) => l.nature === 'ASSET' && l.balance !== 0).map((l) => ({ name: l.name, value: l.balance }));
  const liabilities = data.ledgers.filter((l) => l.nature === 'LIABILITY' && l.balance !== 0).map((l) => ({ name: l.name, value: l.balance }));
  const profit = data.pl.profit;
  const ta = assets.reduce((s, l) => s + l.value, 0);
  const tl = liabilities.reduce((s, l) => s + l.value, 0) + profit;
  return (
    <Panel title="Balance Sheet">
      <ReportBar onBack={onBack} onPdf={onPdf} onExcel={onExcel} />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatementCol title="Liabilities" rows={liabilities} total={tl} extraLabel="Profit & Loss (current)" extra={profit} />
        <StatementCol title="Assets" rows={assets} total={ta} />
      </div>
      <p className={`mt-3 text-center text-[12px] ${Math.round(ta * 100) === Math.round(tl * 100) ? 'text-emerald-700' : 'text-rose-700'}`}>
        {Math.round(ta * 100) === Math.round(tl * 100) ? 'Balanced ✓' : `Difference ₹ ${inr(Math.abs(ta - tl))}`}
      </p>
    </Panel>
  );
}

function StatementCol({ title, rows, total, extraLabel, extra }: { title: string; rows: Array<{ name: string; value: number }>; total: number; extraLabel?: string; extra?: number }) {
  return (
    <div className="rounded border border-[#0f2038]/30 bg-white/50 p-2">
      <p className="mb-1 border-b border-[#0f2038]/30 pb-1 font-bold">{title}</p>
      {rows.map((r, i) => <div key={i} className="flex justify-between py-0.5"><span>{r.name}</span><span className="tabular-nums">{inr(r.value)}</span></div>)}
      {extraLabel && extra != null && <div className="flex justify-between py-0.5 italic"><span>{extraLabel}</span><span className="tabular-nums">{inr(extra)}</span></div>}
      <div className="mt-1 flex justify-between border-t-2 border-[#0f2038] pt-1 font-bold"><span>Total</span><span className="tabular-nums">{inr(total)}</span></div>
    </div>
  );
}

function Ledgers({ data, onBack, onCreate, onOpen, onDelete, pending }: { data: TallyData; onBack: () => void; onCreate: () => void; onOpen: (id: string) => void; onDelete: (id: string) => void; pending: boolean }) {
  return (
    <Panel title="Ledgers">
      <div className="mb-2 flex items-center gap-2"><BackBtn onBack={onBack} /><button onClick={onCreate} className="rounded bg-[#1B2A4A] px-3 py-1 text-[12px] font-semibold text-white">Create ledger (L)</button></div>
      <table className="w-full border-collapse text-[12px]">
        <thead><tr className="bg-[#1B2A4A] text-left text-white"><th className="p-1">Name</th><th className="p-1">Group</th><th className="p-1 text-right">Balance</th><th /></tr></thead>
        <tbody>
          {data.ledgers.map((l) => (
            <tr key={l.id} className="border-b border-[#0f2038]/20"><td className="p-1"><button onClick={() => onOpen(l.id)} className="text-[#1B2A4A] underline hover:text-[#8C6E2C]">{l.name}</button>{l.isSystem && <span className="ml-1 text-[10px] text-[#8C6E2C]">(system)</span>}</td><td className="p-1 text-[#5B4412]">{l.group}</td><td className="p-1 text-right tabular-nums">{inr(l.balance)} {l.side}</td><td className="p-1">{!l.isSystem && <button onClick={() => onDelete(l.id)} disabled={pending} className="text-rose-700 hover:underline">del</button>}</td></tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function CreateLedger({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [pending, start] = React.useTransition();
  const cls = 'border border-[#0f2038]/40 bg-white px-2 py-1 text-[13px]';
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createTallyLedger({ name: fd.get('name'), group: fd.get('group'), openingBalance: Number(fd.get('openingBalance') || 0), openingSide: fd.get('openingSide') });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Ledger created'); onDone();
    });
  };
  return (
    <Panel title="Ledger Creation">
      <BackBtn onBack={onBack} />
      <form onSubmit={submit} className="max-w-md space-y-2">
        <label className="flex items-center justify-between gap-2">Name <input name="name" required className={`${cls} flex-1`} /></label>
        <label className="flex items-center justify-between gap-2">Under (group)
          <select name="group" required defaultValue="Indirect Expenses" className={`${cls} flex-1`}>
            {GROUP_NAMES.map((g) => <option key={g} value={g}>{g} · {natureOfGroup(g)}</option>)}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2">Opening balance <input name="openingBalance" type="number" step="0.01" defaultValue="0" className={`${cls} w-40 text-right`} /></label>
        <label className="flex items-center justify-between gap-2">Opening side <select name="openingSide" defaultValue="Dr" className={cls}><option>Dr</option><option>Cr</option></select></label>
        <button type="submit" disabled={pending} className="rounded bg-[#1B2A4A] px-4 py-1 text-[12px] font-semibold text-white disabled:opacity-50">Accept &amp; Save</button>
      </form>
    </Panel>
  );
}

function ItemInvoice(props: {
  type: 'Sales' | 'Purchase'; setType: (t: 'Sales' | 'Purchase') => void; date: string; setDate: (s: string) => void;
  narr: string; setNarr: (s: string) => void; party: string; setParty: (s: string) => void;
  items: Array<{ itemId: string; qty: string; rate: string }>; setItems: (l: Array<{ itemId: string; qty: string; rate: string }>) => void;
  ledgers: TallyData['ledgers']; stock: TallyData['stock']; taxable: number; gst: number; total: number;
  costCentres: string[]; costCentre: string; setCostCentre: (s: string) => void;
  onSave: () => void; onBack: () => void; pending: boolean; onNewItem: () => void;
}) {
  const { type, setType, date, setDate, narr, setNarr, party, setParty, items, setItems, ledgers, stock, taxable, gst, total, costCentres, costCentre, setCostCentre, onSave, onBack, pending, onNewItem } = props;
  const cls = 'border border-[#0f2038]/40 bg-white px-2 py-1 text-[13px]';
  const setItem = (i: number, patch: Partial<{ itemId: string; qty: string; rate: string }>) => setItems(items.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const partyGroups = type === 'Sales' ? ['Sundry Debtors'] : ['Sundry Creditors'];
  const partyLedgers = ledgers.filter((l) => partyGroups.includes(l.group));
  const stockById = new Map(stock.map((s) => [s.id, s]));

  return (
    <Panel title={`${type} Invoice (item)`}>
      <BackBtn onBack={onBack} />
      {stock.length === 0 && <p className="mb-2 rounded bg-amber-100 px-2 py-1 text-[12px] text-amber-800">No stock items yet — <button onClick={onNewItem} className="underline">create one</button> first.</p>}
      <div className="mb-2 flex gap-1">
        {(['Sales', 'Purchase'] as const).map((t) => <button key={t} onClick={() => setType(t)} className={`rounded px-2 py-0.5 text-[11px] ${t === type ? 'bg-[#1B2A4A] text-white' : 'bg-white/70 hover:bg-white'}`}>{t} <kbd className="text-[#8C6E2C]">{t === 'Sales' ? 'F8' : 'F9'}</kbd></button>)}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1">Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cls} /></label>
        <label className="flex items-center gap-1">Party
          <select value={party} onChange={(e) => setParty(e.target.value)} className={`${cls} min-w-[12rem]`}>
            <option value="">— {type === 'Sales' ? 'debtor' : 'creditor'} —</option>
            {partyLedgers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        {costCentres.length > 0 && (
          <label className="flex items-center gap-1">Cost centre
            <select value={costCentre} onChange={(e) => setCostCentre(e.target.value)} className={cls}>
              <option value="">— none —</option>
              {costCentres.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
        <span className="text-[11px] text-[#5B4412]">Party ledger must be under {partyGroups[0]} — create it in Ledgers (L).</span>
      </div>

      <table className="w-full border-collapse">
        <thead><tr className="bg-[#1B2A4A] text-left text-white"><th className="p-1">Item</th><th className="w-24 p-1 text-right">Qty</th><th className="w-24 p-1 text-right">Rate</th><th className="w-16 p-1 text-right">GST%</th><th className="w-28 p-1 text-right">Amount</th><th className="w-8" /></tr></thead>
        <tbody>
          {items.map((l, i) => {
            const it = stockById.get(l.itemId);
            const amount = (Number(l.qty) || 0) * (Number(l.rate) || 0);
            return (
              <tr key={i} className="border-b border-[#0f2038]/20">
                <td className="p-1"><select value={l.itemId} onChange={(e) => setItem(i, { itemId: e.target.value, rate: l.rate || (stockById.get(e.target.value)?.rate ? String(stockById.get(e.target.value)!.rate) : '') })} className={`${cls} w-full`}><option value="">— item —</option>{stock.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}</select></td>
                <td className="p-1 text-right"><input inputMode="decimal" value={l.qty} onChange={(e) => setItem(i, { qty: e.target.value })} className={`${cls} w-20 text-right`} /></td>
                <td className="p-1 text-right"><input inputMode="decimal" value={l.rate} onChange={(e) => setItem(i, { rate: e.target.value })} className={`${cls} w-20 text-right`} /></td>
                <td className="p-1 text-right tabular-nums">{it ? it.gstRate : 0}</td>
                <td className="p-1 text-right tabular-nums">{inr(amount)}</td>
                <td className="p-1 text-center"><button onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== i) : items)} className="text-rose-700">✕</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-1"><button onClick={() => setItems([...items, { itemId: '', qty: '', rate: '' }])} className="rounded border border-[#0f2038]/40 bg-white/70 px-2 py-1 text-[12px] hover:bg-white">+ Add item</button></div>

      <div className="mt-3 flex flex-wrap items-end gap-4">
        <label className="flex flex-1 items-center gap-1">Narration <input value={narr} onChange={(e) => setNarr(e.target.value)} className={`${cls} min-w-[10rem] flex-1`} /></label>
        <div className="rounded border border-[#0f2038]/30 bg-white/50 p-2 text-[12px]">
          <Row k="Taxable" v={`₹ ${inr(taxable)}`} />
          <Row k="GST" v={`₹ ${inr(gst)}`} />
          <Row k="Invoice total" v={`₹ ${inr(total)}`} strong />
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="rounded border border-[#0f2038]/40 px-3 py-1 text-[12px] hover:bg-white/60">Esc — Cancel</button>
          <button onClick={onSave} disabled={pending || total <= 0} className="rounded bg-[#1B2A4A] px-4 py-1 text-[12px] font-semibold text-white disabled:opacity-50">Accept &amp; Save</button>
        </div>
      </div>
    </Panel>
  );
}

function StockItems({ data, onBack, onCreate, onDelete, pending }: { data: TallyData; onBack: () => void; onCreate: () => void; onDelete: (id: string) => void; pending: boolean }) {
  return (
    <Panel title="Stock Items">
      <div className="mb-2 flex items-center gap-2"><BackBtn onBack={onBack} /><button onClick={onCreate} className="rounded bg-[#1B2A4A] px-3 py-1 text-[12px] font-semibold text-white">Create item</button></div>
      <table className="w-full border-collapse text-[12px]">
        <thead><tr className="bg-[#1B2A4A] text-left text-white"><th className="p-1">Name</th><th className="p-1">Unit</th><th className="p-1 text-right">GST%</th><th className="p-1 text-right">Closing qty</th><th className="p-1 text-right">Value</th><th /></tr></thead>
        <tbody>
          {data.stock.length === 0 ? <tr><td colSpan={6} className="p-4 text-center text-[#5B4412]">No stock items yet.</td></tr> : data.stock.map((s) => (
            <tr key={s.id} className="border-b border-[#0f2038]/20"><td className="p-1">{s.name}</td><td className="p-1">{s.unit}</td><td className="p-1 text-right tabular-nums">{s.gstRate}</td><td className="p-1 text-right tabular-nums">{s.closingQty}</td><td className="p-1 text-right tabular-nums">{inr(s.value)}</td><td className="p-1"><button onClick={() => onDelete(s.id)} disabled={pending} className="text-rose-700 hover:underline">del</button></td></tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function CreateStock({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [pending, start] = React.useTransition();
  const cls = 'border border-[#0f2038]/40 bg-white px-2 py-1 text-[13px]';
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createTallyStockItem({ name: fd.get('name'), unit: fd.get('unit') || 'Nos', hsn: fd.get('hsn') || undefined, gstRate: Number(fd.get('gstRate') || 0), openingQty: Number(fd.get('openingQty') || 0), openingRate: Number(fd.get('openingRate') || 0) });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Stock item created'); onDone();
    });
  };
  return (
    <Panel title="Stock Item Creation">
      <BackBtn onBack={onBack} />
      <form onSubmit={submit} className="max-w-md space-y-2">
        <label className="flex items-center justify-between gap-2">Name <input name="name" required className={`${cls} flex-1`} /></label>
        <label className="flex items-center justify-between gap-2">Unit <input name="unit" defaultValue="Nos" className={`${cls} w-32`} /></label>
        <label className="flex items-center justify-between gap-2">HSN/SAC <input name="hsn" className={`${cls} w-40`} /></label>
        <label className="flex items-center justify-between gap-2">GST rate % <input name="gstRate" type="number" step="0.01" defaultValue="18" className={`${cls} w-32 text-right`} /></label>
        <label className="flex items-center justify-between gap-2">Opening qty <input name="openingQty" type="number" step="0.001" defaultValue="0" className={`${cls} w-32 text-right`} /></label>
        <label className="flex items-center justify-between gap-2">Opening rate <input name="openingRate" type="number" step="0.01" defaultValue="0" className={`${cls} w-32 text-right`} /></label>
        <button type="submit" disabled={pending} className="rounded bg-[#1B2A4A] px-4 py-1 text-[12px] font-semibold text-white disabled:opacity-50">Accept &amp; Save</button>
      </form>
    </Panel>
  );
}

function StockSummary({ data, onBack, onPdf, onExcel }: { data: TallyData; onBack: () => void; onPdf: () => void; onExcel: () => void }) {
  const totalValue = data.stock.reduce((s, r) => s + r.value, 0);
  return (
    <Panel title="Stock Summary">
      <ReportBar onBack={onBack} onPdf={onPdf} onExcel={onExcel} />
      <table className="w-full border-collapse text-[12px]">
        <thead><tr className="bg-[#1B2A4A] text-left text-white"><th className="p-1">Item</th><th className="p-1">Unit</th><th className="p-1 text-right">Inward</th><th className="p-1 text-right">Outward</th><th className="p-1 text-right">Closing</th><th className="p-1 text-right">Rate</th><th className="p-1 text-right">Value</th></tr></thead>
        <tbody>
          {data.stock.length === 0 ? <tr><td colSpan={7} className="p-4 text-center text-[#5B4412]">No stock items yet.</td></tr> : data.stock.map((s) => (
            <tr key={s.id} className="border-b border-[#0f2038]/20"><td className="p-1">{s.name}</td><td className="p-1">{s.unit}</td><td className="p-1 text-right tabular-nums">{s.inQty}</td><td className="p-1 text-right tabular-nums">{s.outQty}</td><td className="p-1 text-right tabular-nums">{s.closingQty}</td><td className="p-1 text-right tabular-nums">{inr(s.rate)}</td><td className="p-1 text-right tabular-nums">{inr(s.value)}</td></tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t-2 border-[#0f2038] font-bold"><td className="p-1" colSpan={6}>Total stock value</td><td className="p-1 text-right tabular-nums">{inr(totalValue)}</td></tr></tfoot>
      </table>
    </Panel>
  );
}

function ageCols(r: { total: number; b0: number; b30: number; b60: number; b90: number }) {
  return { '0-30': r.b0, '31-60': r.b30, '61-90': r.b60, '90+': r.b90, Total: r.total };
}

function LedgerStatement({ stmt, onBack, onExcel }: { stmt: LedgerStmt | null; onBack: () => void; onExcel: () => void }) {
  if (!stmt) return <Panel title="Ledger"><BackBtn onBack={onBack} /><p className="text-[#5B4412]">Loading…</p></Panel>;
  if ('error' in stmt) return <Panel title="Ledger"><BackBtn onBack={onBack} /><p className="text-rose-700">{stmt.error}</p></Panel>;
  return (
    <Panel title={`Ledger — ${stmt.name}`}>
      <div className="mb-2 flex items-center gap-2"><button onClick={onBack} className="rounded border border-[#0f2038]/40 px-3 py-1 text-[12px] hover:bg-white/60">← Esc — Back</button><span className="text-[12px] text-[#5B4412]">{stmt.group}</span><button onClick={onExcel} className="ml-auto rounded border border-[#0f2038]/40 bg-white/70 px-3 py-1 text-[12px] hover:bg-white">Excel</button></div>
      <table className="w-full border-collapse text-[12px]">
        <thead><tr className="bg-[#1B2A4A] text-left text-white"><th className="p-1">Date</th><th className="p-1">Voucher</th><th className="p-1">Particulars</th><th className="p-1 text-right">Debit</th><th className="p-1 text-right">Credit</th><th className="p-1 text-right">Balance</th></tr></thead>
        <tbody>
          {stmt.rows.length === 0 ? <tr><td colSpan={6} className="p-4 text-center text-[#5B4412]">No entries.</td></tr> : stmt.rows.map((r, i) => (
            <tr key={i} className="border-b border-[#0f2038]/20"><td className="whitespace-nowrap p-1">{new Date(r.date).toLocaleDateString('en-IN')}</td><td className="p-1">{r.type} #{r.number}</td><td className="p-1">{r.particulars}</td><td className="p-1 text-right tabular-nums">{r.debit ? inr(r.debit) : ''}</td><td className="p-1 text-right tabular-nums">{r.credit ? inr(r.credit) : ''}</td><td className="p-1 text-right tabular-nums">{inr(r.balance)} {r.balanceSide}</td></tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t-2 border-[#0f2038] font-bold"><td className="p-1" colSpan={5}>Closing balance</td><td className="p-1 text-right tabular-nums">{inr(stmt.closing)} {stmt.closingSide}</td></tr></tfoot>
      </table>
    </Panel>
  );
}

function OutstandingView({ o, onBack, onExcel, onOpen }: { o: Outstanding | null; onBack: () => void; onExcel: () => void; onOpen: (name: string) => void }) {
  if (!o) return <Panel title="Outstanding"><BackBtn onBack={onBack} /><p className="text-[#5B4412]">Loading…</p></Panel>;
  if ('error' in o) return <Panel title="Outstanding"><BackBtn onBack={onBack} /><p className="text-rose-700">{o.error}</p></Panel>;
  const Table = ({ title, rows, total }: { title: string; rows: AgedParty[]; total: number }) => (
    <div className="mb-4">
      <p className="mb-1 font-bold text-[#1B2A4A]">{title} — ₹ {inr(total)}</p>
      <table className="w-full border-collapse text-[12px]">
        <thead><tr className="bg-[#1B2A4A] text-left text-white"><th className="p-1">Party</th><th className="p-1 text-right">0–30</th><th className="p-1 text-right">31–60</th><th className="p-1 text-right">61–90</th><th className="p-1 text-right">90+</th><th className="p-1 text-right">Total</th></tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={6} className="p-3 text-center text-[#5B4412]">Nothing outstanding.</td></tr> : rows.map((r) => (
            <tr key={r.name} className="border-b border-[#0f2038]/20"><td className="p-1"><button onClick={() => onOpen(r.name)} className="text-[#1B2A4A] underline hover:text-[#8C6E2C]">{r.name}</button></td><td className="p-1 text-right tabular-nums">{r.b0 ? inr(r.b0) : ''}</td><td className="p-1 text-right tabular-nums">{r.b30 ? inr(r.b30) : ''}</td><td className="p-1 text-right tabular-nums">{r.b60 ? inr(r.b60) : ''}</td><td className={`p-1 text-right tabular-nums ${r.b90 ? 'font-semibold text-rose-700' : ''}`}>{r.b90 ? inr(r.b90) : ''}</td><td className="p-1 text-right font-semibold tabular-nums">{inr(r.total)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <Panel title="Outstanding (bill-wise ageing)">
      <div className="mb-2 flex items-center gap-2"><button onClick={onBack} className="rounded border border-[#0f2038]/40 px-3 py-1 text-[12px] hover:bg-white/60">← Esc — Gateway</button><button onClick={onExcel} className="ml-auto rounded border border-[#0f2038]/40 bg-white/70 px-3 py-1 text-[12px] hover:bg-white">Excel</button></div>
      <Table title="Receivables (money owed to us)" rows={o.receivables} total={o.totalReceivable} />
      <Table title="Payables (money we owe)" rows={o.payables} total={o.totalPayable} />
      <p className="text-[11px] text-[#5B4412]">Ageing is FIFO — the oldest unpaid charges age into each bucket. Click a party to open its ledger.</p>
    </Panel>
  );
}

function CostCentres({ data, onBack, onCreate, onReport, pending }: { data: TallyData; onBack: () => void; onCreate: (name: string) => void; onReport: () => void; pending: boolean }) {
  const [name, setName] = React.useState('');
  const cls = 'border border-[#0f2038]/40 bg-white px-2 py-1 text-[13px]';
  const submit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const nm = name.trim(); if (!nm) return; onCreate(nm); setName(''); };
  return (
    <Panel title="Cost Centres">
      <div className="mb-2 flex items-center gap-2"><BackBtn onBack={onBack} /><button onClick={onReport} className="rounded bg-[#1B2A4A] px-3 py-1 text-[12px] font-semibold text-white">Job Costing report (J)</button></div>
      <p className="mb-3 max-w-2xl text-[12px] text-[#5B4412]">A cost centre is a project or site you want to track profit for — e.g. <em>Tower A</em>, <em>Clubhouse</em>, <em>Phase 2</em>. Tag it on any voucher or invoice, then open Job Costing to see income, expense and profit for each centre.</p>
      <form onSubmit={submit} className="mb-4 flex max-w-md items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New cost centre name" className={`${cls} flex-1`} />
        <button type="submit" disabled={pending || !name.trim()} className="rounded bg-[#1B2A4A] px-4 py-1 text-[12px] font-semibold text-white disabled:opacity-50">Create</button>
      </form>
      <table className="w-full max-w-md border-collapse text-[12px]">
        <thead><tr className="bg-[#1B2A4A] text-left text-white"><th className="p-1">#</th><th className="p-1">Cost Centre</th></tr></thead>
        <tbody>
          {data.costCentres.length === 0 ? <tr><td colSpan={2} className="p-4 text-center text-[#5B4412]">No cost centres yet. Create one above.</td></tr> : data.costCentres.map((c, i) => (
            <tr key={c} className="border-b border-[#0f2038]/20"><td className="p-1 tabular-nums text-[#5B4412]">{i + 1}</td><td className="p-1">{c}</td></tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function JobCosting({ report, label, onBack, onExcel }: { report: CostReport | null; label: string; onBack: () => void; onExcel: () => void }) {
  if (!report) return <Panel title="Job Costing"><BackBtn onBack={onBack} /><p className="text-[#5B4412]">Loading…</p></Panel>;
  if ('error' in report) return <Panel title="Job Costing"><BackBtn onBack={onBack} /><p className="text-rose-700">{report.error}</p></Panel>;
  const ti = report.rows.reduce((s, r) => s + r.income, 0);
  const te = report.rows.reduce((s, r) => s + r.expense, 0);
  const tp = report.rows.reduce((s, r) => s + r.profit, 0);
  return (
    <Panel title={`Job Costing — ${label}`}>
      <div className="mb-2 flex items-center gap-2"><button onClick={onBack} className="rounded border border-[#0f2038]/40 px-3 py-1 text-[12px] hover:bg-white/60">← Esc — Gateway</button><button onClick={onExcel} className="ml-auto rounded border border-[#0f2038]/40 bg-white/70 px-3 py-1 text-[12px] hover:bg-white">Excel</button></div>
      <table className="w-full border-collapse text-[12px]">
        <thead><tr className="bg-[#1B2A4A] text-left text-white"><th className="p-1">Cost Centre</th><th className="p-1 text-right">Income</th><th className="p-1 text-right">Expense</th><th className="p-1 text-right">Profit / (Loss)</th></tr></thead>
        <tbody>
          {report.rows.length === 0 ? <tr><td colSpan={4} className="p-4 text-center text-[#5B4412]">No entries tagged to a cost centre in this period.</td></tr> : report.rows.map((r) => (
            <tr key={r.name} className="border-b border-[#0f2038]/20"><td className="p-1">{r.name}</td><td className="p-1 text-right tabular-nums">{inr(r.income)}</td><td className="p-1 text-right tabular-nums">{inr(r.expense)}</td><td className={`p-1 text-right font-semibold tabular-nums ${r.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{inr(r.profit)}</td></tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t-2 border-[#0f2038] font-bold"><td className="p-1">Total</td><td className="p-1 text-right tabular-nums">{inr(ti)}</td><td className="p-1 text-right tabular-nums">{inr(te)}</td><td className={`p-1 text-right tabular-nums ${tp >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{inr(tp)}</td></tr></tfoot>
      </table>
      <p className="mt-2 text-[11px] text-[#5B4412]">Income and expense are the movement on income/expense ledgers in vouchers tagged to each centre. Untagged entries show as “Unallocated”.</p>
    </Panel>
  );
}

function ScheduleThree({ sch, onBack, onExcel }: { sch: ScheduleIII | null; onBack: () => void; onExcel: () => void }) {
  if (!sch) return <Panel title="Schedule III"><BackBtn onBack={onBack} /><p className="text-[#5B4412]">Loading…</p></Panel>;
  if ('error' in sch) return <Panel title="Schedule III"><BackBtn onBack={onBack} /><p className="text-rose-700">{sch.error}</p></Panel>;
  const Col = ({ title, sections, total }: { title: string; sections: Array<{ title: string; heads: Array<{ label: string; amount: number }>; total: number }>; total: number }) => (
    <div className="rounded border border-[#0f2038]/30 bg-white/50 p-2">
      <p className="mb-1 border-b-2 border-[#0f2038] pb-1 font-bold text-[#1B2A4A]">{title}</p>
      {sections.map((s) => (
        <div key={s.title} className="mb-2">
          <div className="flex justify-between font-semibold"><span>{s.title}</span><span className="tabular-nums">{inr(s.total)}</span></div>
          {s.heads.map((h) => <div key={h.label} className="flex justify-between pl-3 text-[12px] text-[#5B4412]"><span>{h.label}</span><span className="tabular-nums">{inr(h.amount)}</span></div>)}
        </div>
      ))}
      <div className="mt-1 flex justify-between border-t-2 border-[#0f2038] pt-1 font-bold"><span>Total</span><span className="tabular-nums">{inr(total)}</span></div>
    </div>
  );
  return (
    <Panel title={`Balance Sheet — Schedule III (Division I) · ${sch.asOf}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2"><button onClick={onBack} className="rounded border border-[#0f2038]/40 px-3 py-1 text-[12px] hover:bg-white/60">← Esc — Gateway</button><button onClick={onExcel} className="ml-auto rounded border border-[#0f2038]/40 bg-white/70 px-3 py-1 text-[12px] hover:bg-white">Excel</button></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Col title="I. Equity and Liabilities" sections={sch.equityLiabilities} total={sch.totalEL} />
        <Col title="II. Assets" sections={sch.assets} total={sch.totalAssets} />
      </div>
      <p className={`mt-3 text-center text-[12px] ${sch.balanced ? 'text-emerald-700' : 'text-rose-700'}`}>{sch.balanced ? 'Balanced ✓' : `Difference ₹ ${inr(Math.abs(sch.totalEL - sch.totalAssets))}`}</p>
      <p className="mt-1 text-[11px] text-[#5B4412]">Ledger balances recast into the Companies Act, 2013 Schedule III (Division I) heads, with the period’s profit taken to Reserves & surplus. A presentation aid — your CA finalises the statutory format.</p>
    </Panel>
  );
}

function RatioAnalysis({ ratios, onBack, onExcel }: { ratios: Ratios | null; onBack: () => void; onExcel: () => void }) {
  if (!ratios) return <Panel title="Ratio Analysis"><BackBtn onBack={onBack} /><p className="text-[#5B4412]">Loading…</p></Panel>;
  if ('error' in ratios) return <Panel title="Ratio Analysis"><BackBtn onBack={onBack} /><p className="text-rose-700">{ratios.error}</p></Panel>;
  return (
    <Panel title={`Ratio Analysis — ${ratios.asOf}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2"><button onClick={onBack} className="rounded border border-[#0f2038]/40 px-3 py-1 text-[12px] hover:bg-white/60">← Esc — Gateway</button><button onClick={onExcel} className="ml-auto rounded border border-[#0f2038]/40 bg-white/70 px-3 py-1 text-[12px] hover:bg-white">Excel</button></div>
      <div className="grid gap-2 sm:grid-cols-2">
        {ratios.rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between rounded border border-[#0f2038]/30 bg-white/50 p-2">
            <div><p className="font-semibold text-[#1B2A4A]">{r.name}</p><p className="text-[10px] text-[#5B4412]">{r.hint}</p></div>
            <p className="text-[15px] font-bold tabular-nums text-[#1B2A4A]">{r.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-[#5B4412]">Ratios use the balance sheet as-at the period end and the profit for the period. “—” means the denominator is zero. A guide for your CA, not a substitute for their review.</p>
    </Panel>
  );
}

function FlowsView({ flows, label, onBack, onExcel }: { flows: FlowStatements | null; label: string; onBack: () => void; onExcel: () => void }) {
  if (!flows) return <Panel title="Cash Flow & Funds Flow"><BackBtn onBack={onBack} /><p className="text-[#5B4412]">Loading…</p></Panel>;
  const c = flows.cash, f = flows.funds;
  const FlowCol = ({ title, rows, total }: { title: string; rows: FlowRow[]; total: number }) => (
    <div className="rounded border border-[#0f2038]/30 bg-white/50 p-2">
      <p className="mb-1 border-b border-[#0f2038]/30 pb-1 font-bold">{title}</p>
      {rows.length === 0 ? <p className="py-1 text-[#5B4412]">None.</p> : rows.map((r, i) => <div key={i} className="flex justify-between py-0.5"><span>{r.name} <span className="text-[10px] text-[#5B4412]">· {r.group}</span></span><span className="tabular-nums">{inr(r.amount)}</span></div>)}
      <div className="mt-1 flex justify-between border-t-2 border-[#0f2038] pt-1 font-bold"><span>Total</span><span className="tabular-nums">{inr(total)}</span></div>
    </div>
  );
  return (
    <Panel title={`Cash Flow & Funds Flow — ${label}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2"><button onClick={onBack} className="rounded border border-[#0f2038]/40 px-3 py-1 text-[12px] hover:bg-white/60">← Esc — Gateway</button><button onClick={onExcel} className="ml-auto rounded border border-[#0f2038]/40 bg-white/70 px-3 py-1 text-[12px] hover:bg-white">Excel</button></div>
      <p className="mb-1 font-bold text-[#1B2A4A]">Cash Flow (cash &amp; bank)</p>
      <div className="mb-2 grid gap-2 sm:grid-cols-3 text-[12px]">
        <div className="rounded border border-[#0f2038]/30 bg-white/50 p-2"><p className="text-[#5B4412]">Opening cash &amp; bank</p><p className="text-[14px] font-bold tabular-nums">₹ {inr(c.opening)}</p></div>
        <div className="rounded border border-[#0f2038]/30 bg-white/50 p-2"><p className="text-[#5B4412]">Net cash flow</p><p className={`text-[14px] font-bold tabular-nums ${c.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>₹ {inr(c.net)}</p></div>
        <div className="rounded border-2 border-[#1B2A4A] bg-white/70 p-2"><p className="text-[#5B4412]">Closing cash &amp; bank</p><p className="text-[14px] font-bold tabular-nums">₹ {inr(c.closing)}</p></div>
      </div>
      <div className="mb-4 grid gap-2 text-[12px] sm:grid-cols-2">
        <FlowCol title="Inflows (money received)" rows={c.inflows} total={c.totalIn} />
        <FlowCol title="Outflows (money paid)" rows={c.outflows} total={c.totalOut} />
      </div>
      <p className="mb-1 font-bold text-[#1B2A4A]">Funds Flow (sources &amp; applications)</p>
      <div className="grid gap-2 text-[12px] sm:grid-cols-2">
        <FlowCol title="Sources of funds" rows={f.sources} total={f.totalSources} />
        <FlowCol title="Application of funds" rows={f.applications} total={f.totalApplications} />
      </div>
      <p className="mt-2 text-[11px] text-[#5B4412]">Cash Flow tracks the actual movement of cash &amp; bank in the period. Funds Flow shows where funds came from and where they were applied — the movement of every asset, liability and capital account, plus the period’s profit as a source.</p>
    </Panel>
  );
}

function GstReturnsView({ gst, label, onBack, onExcel }: { gst: GstReturns | null; label: string; onBack: () => void; onExcel: () => void }) {
  if (!gst) return <Panel title="GST Returns"><BackBtn onBack={onBack} /><p className="text-[#5B4412]">Loading…</p></Panel>;
  const b = gst.gstr3b;
  const RateTable = ({ title, rows, tot }: { title: string; rows: GstRateRow[]; tot: { taxable: number; cgst: number; sgst: number; totalTax: number } }) => (
    <div className="mb-4">
      <p className="mb-1 font-bold text-[#1B2A4A]">{title}</p>
      <table className="w-full border-collapse text-[12px]">
        <thead><tr className="bg-[#1B2A4A] text-left text-white"><th className="p-1 text-right">Rate %</th><th className="p-1 text-right">Taxable value</th><th className="p-1 text-right">CGST</th><th className="p-1 text-right">SGST</th><th className="p-1 text-right">Total tax</th></tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={5} className="p-3 text-center text-[#5B4412]">Nothing in this period.</td></tr> : rows.map((r) => (
            <tr key={r.rate} className="border-b border-[#0f2038]/20"><td className="p-1 text-right tabular-nums">{r.rate}</td><td className="p-1 text-right tabular-nums">{inr(r.taxable)}</td><td className="p-1 text-right tabular-nums">{inr(r.cgst)}</td><td className="p-1 text-right tabular-nums">{inr(r.sgst)}</td><td className="p-1 text-right font-semibold tabular-nums">{inr(r.totalTax)}</td></tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t-2 border-[#0f2038] font-bold"><td className="p-1 text-right">Total</td><td className="p-1 text-right tabular-nums">{inr(tot.taxable)}</td><td className="p-1 text-right tabular-nums">{inr(tot.cgst)}</td><td className="p-1 text-right tabular-nums">{inr(tot.sgst)}</td><td className="p-1 text-right tabular-nums">{inr(tot.totalTax)}</td></tr></tfoot>
      </table>
    </div>
  );
  return (
    <Panel title={`GST Returns — ${label}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2"><button onClick={onBack} className="rounded border border-[#0f2038]/40 px-3 py-1 text-[12px] hover:bg-white/60">← Esc — Gateway</button><button onClick={onExcel} className="ml-auto rounded border border-[#0f2038]/40 bg-white/70 px-3 py-1 text-[12px] hover:bg-white">Excel</button></div>
      <RateTable title="GSTR-1 — Outward supplies (sales) by rate" rows={gst.gstr1} tot={gst.gstr1Total} />
      <RateTable title="Input Tax Credit — Inward supplies (purchases) by rate" rows={gst.itc} tot={{ taxable: b.inwardTaxable, cgst: b.inputCgst, sgst: b.inputSgst, totalTax: b.inputTax }} />
      {gst.hsn.length > 0 && (
        <div className="mb-4">
          <p className="mb-1 font-bold text-[#1B2A4A]">HSN-wise summary of outward supplies (GSTR-1, Table 12)</p>
          <table className="w-full border-collapse text-[12px]">
            <thead><tr className="bg-[#1B2A4A] text-left text-white"><th className="p-1">HSN/SAC</th><th className="p-1 text-right">Rate %</th><th className="p-1 text-right">Qty</th><th className="p-1 text-right">Taxable value</th><th className="p-1 text-right">Tax</th></tr></thead>
            <tbody>
              {gst.hsn.map((r, i) => (
                <tr key={i} className="border-b border-[#0f2038]/20"><td className="p-1">{r.hsn}</td><td className="p-1 text-right tabular-nums">{r.rate}</td><td className="p-1 text-right tabular-nums">{r.qty}</td><td className="p-1 text-right tabular-nums">{inr(r.taxable)}</td><td className="p-1 text-right tabular-nums">{inr(r.tax)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mb-2 rounded border-2 border-[#1B2A4A] bg-white/60 p-3 text-[12px]">
        <p className="mb-1 font-bold text-[#1B2A4A]">GSTR-3B — Net tax payable</p>
        <Row k="Output tax (on sales)" v={`₹ ${inr(b.outputTax)}`} />
        <Row k="Less: Input tax credit (on purchases)" v={`₹ ${inr(b.inputTax)}`} />
        <Row k="Net CGST payable" v={`₹ ${inr(b.netCgst)}`} />
        <Row k="Net SGST payable" v={`₹ ${inr(b.netSgst)}`} />
        <Row k="Net GST payable" v={`₹ ${inr(b.netPayable)}`} strong />
      </div>
      <p className="text-[11px] text-[#5B4412]">Computed from item invoices, split CGST/SGST assuming intra-state supply. For inter-state (IGST), reverse-charge, or filing-ready GSTR JSON, use the connected GST tier once configured. Always have your CA review before filing.</p>
    </Panel>
  );
}

function EditHeader({ date, setDate, narr, setNarr, costCentres, costCentre, setCostCentre, onSave, onBack, pending }: { date: string; setDate: (s: string) => void; narr: string; setNarr: (s: string) => void; costCentres: string[]; costCentre: string; setCostCentre: (s: string) => void; onSave: () => void; onBack: () => void; pending: boolean }) {
  const cls = 'border border-[#0f2038]/40 bg-white px-2 py-1 text-[13px]';
  return (
    <Panel title="Edit Invoice — header">
      <BackBtn onBack={onBack} />
      <p className="mb-3 max-w-2xl text-[12px] text-[#5B4412]">Item invoices carry stock movements, so amounts and items can’t be changed here — to change those, delete the invoice and post it again. You can still correct the date, narration and cost centre below.</p>
      <div className="max-w-md space-y-2">
        <label className="flex items-center justify-between gap-2">Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${cls} flex-1`} /></label>
        <label className="flex items-center justify-between gap-2">Narration <input value={narr} onChange={(e) => setNarr(e.target.value)} className={`${cls} flex-1`} /></label>
        {costCentres.length > 0 && (
          <label className="flex items-center justify-between gap-2">Cost centre
            <select value={costCentre} onChange={(e) => setCostCentre(e.target.value)} className={`${cls} flex-1`}>
              <option value="">— none —</option>
              {costCentres.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
        <button onClick={onSave} disabled={pending} className="rounded bg-[#1B2A4A] px-4 py-1 text-[12px] font-semibold text-white disabled:opacity-50">Accept &amp; Save</button>
      </div>
    </Panel>
  );
}

const SHORTCUT_GROUPS: Array<{ title: string; rows: Array<{ keys: string; label: string }> }> = [
  { title: 'Voucher entry (from anywhere)', rows: [
    { keys: 'F4', label: 'Contra' }, { keys: 'F5', label: 'Payment' }, { keys: 'F6', label: 'Receipt' },
    { keys: 'F7', label: 'Journal' }, { keys: 'F8', label: 'Sales invoice' }, { keys: 'F9', label: 'Purchase invoice' },
  ] },
  { title: 'Reports (from the Gateway)', rows: [
    { keys: 'D', label: 'Day Book' }, { keys: 'T', label: 'Trial Balance' }, { keys: 'P', label: 'Profit & Loss' },
    { keys: 'B', label: 'Balance Sheet' }, { keys: 'S', label: 'Stock Summary' }, { keys: 'O', label: 'Outstanding (ageing)' },
    { keys: 'G', label: 'GST Returns' }, { keys: 'F', label: 'Cash / Funds Flow' }, { keys: 'A', label: 'Ratio Analysis' }, { keys: 'J', label: 'Job Costing' },
  ] },
  { title: 'Masters & tools', rows: [
    { keys: 'V', label: 'Accounting voucher' }, { keys: 'L', label: 'Ledgers' }, { keys: 'I', label: 'Stock Items' },
    { keys: 'C', label: 'Cost Centres' }, { keys: 'R', label: 'Bank Reconciliation' }, { keys: '?', label: 'This shortcuts screen' },
  ] },
  { title: 'Everywhere', rows: [
    { keys: 'Esc', label: 'Go back / cancel' },
  ] },
];

function ShortcutsScreen({ os, onBack }: { os: 'auto' | 'mac' | 'windows'; onBack: () => void }) {
  const [view, setView] = React.useState<'mac' | 'windows'>(os === 'mac' ? 'mac' : 'windows');
  React.useEffect(() => {
    if (os === 'auto' && typeof navigator !== 'undefined') {
      const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
      setView(isMac ? 'mac' : 'windows');
    }
  }, [os]);
  const press = (keys: string) => (view === 'mac' && /^F\d/.test(keys) ? `fn + ${keys}` : keys);
  return (
    <Panel title="Keyboard shortcuts">
      <div className="mb-3 flex items-center gap-2">
        <BackBtn onBack={onBack} />
        <div className="ml-auto flex overflow-hidden rounded border border-[#0f2038]/40 text-[11px]">
          {(['windows', 'mac'] as const).map((o) => (
            <button key={o} onClick={() => setView(o)} className={`px-3 py-1 ${view === o ? 'bg-[#1B2A4A] text-white' : 'bg-white/70'}`}>{o === 'mac' ? 'Mac' : 'Windows'}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {SHORTCUT_GROUPS.map((g) => (
          <div key={g.title} className="rounded border border-[#0f2038]/30 bg-white/50 p-2">
            <p className="mb-1 border-b border-[#0f2038]/30 pb-1 font-bold text-[#1B2A4A]">{g.title}</p>
            {g.rows.map((r) => (
              <div key={r.keys} className="flex items-center justify-between py-0.5">
                <span>{r.label}</span>
                <kbd className="rounded border border-[#0f2038]/40 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-[#8C6E2C]">{press(r.keys)}</kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-[#5B4412]">
        {view === 'mac'
          ? 'On a Mac laptop the top row are “media” keys by default, so the function keys need fn (e.g. fn + F5). Turn on System Settings → Keyboard → “Use F1, F2 … as standard function keys” to press them directly. Esc is just Esc.'
          : 'On Windows the function keys F4–F9 work directly. Esc goes back or cancels the current voucher.'}
      </p>
    </Panel>
  );
}

function TallySettings({ prefs, onBack, onSaved }: { prefs: TallyPrefs; onBack: () => void; onSaved: () => void }) {
  const [pending, start] = React.useTransition();
  const [companyName, setCompanyName] = React.useState(prefs.companyName);
  const [defaultVoucher, setDefaultVoucher] = React.useState(prefs.defaultVoucher);
  const [defaultPeriod, setDefaultPeriod] = React.useState(prefs.defaultPeriod);
  const [os, setOs] = React.useState(prefs.os);
  const cls = 'border border-[#0f2038]/40 bg-white px-2 py-1 text-[13px]';
  const save = () => start(async () => {
    const r = await saveTallyPrefs({ companyName, defaultVoucher, defaultPeriod, os });
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Your Tally settings are saved'); onSaved();
  });
  return (
    <Panel title="Tally Settings — just for you">
      <BackBtn onBack={onBack} />
      <p className="mb-3 max-w-2xl text-[12px] text-[#5B4412]">These preferences are personal — each user can set their own. They don’t change anyone else’s Tally or the underlying books.</p>
      <div className="max-w-md space-y-2">
        <label className="flex items-center justify-between gap-2">Company name (title bar)<input value={companyName} onChange={(e) => setCompanyName(e.target.value)} maxLength={80} className={`${cls} flex-1`} /></label>
        <label className="flex items-center justify-between gap-2">Default voucher (F-key start)
          <select value={defaultVoucher} onChange={(e) => setDefaultVoucher(e.target.value)} className={cls}>{VOUCHER_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <label className="flex items-center justify-between gap-2">Default period on open
          <select value={defaultPeriod} onChange={(e) => setDefaultPeriod(e.target.value as TallyPrefs['defaultPeriod'])} className={cls}>
            <option value="all">All time</option><option value="month">This month</option><option value="quarter">This quarter</option><option value="fy">This financial year</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-2">Keyboard style (for shortcuts)
          <select value={os} onChange={(e) => setOs(e.target.value as TallyPrefs['os'])} className={cls}>
            <option value="auto">Auto-detect</option><option value="windows">Windows</option><option value="mac">Mac</option>
          </select>
        </label>
        <button onClick={save} disabled={pending} className="rounded bg-[#1B2A4A] px-4 py-1 text-[12px] font-semibold text-white disabled:opacity-50">Save my settings</button>
      </div>
    </Panel>
  );
}

function BankReconciliation({ data, recon, ledgerId, onPick, onSetCleared, onBack, pending }: { data: TallyData; recon: BankRecon | null; ledgerId: string; onPick: (id: string) => void; onSetCleared: (lineId: string, dateISO: string | null) => void; onBack: () => void; pending: boolean }) {
  const bankLedgers = data.ledgers.filter((l) => l.group === 'Bank Accounts' || l.group === 'Bank OD A/c');
  const cls = 'border border-[#0f2038]/40 bg-white px-2 py-1 text-[13px]';
  return (
    <Panel title="Bank Reconciliation">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <BackBtn onBack={onBack} />
        <label className="flex items-center gap-1">Bank ledger
          <select value={ledgerId} onChange={(e) => onPick(e.target.value)} className={`${cls} min-w-[14rem]`}>
            <option value="">— choose a bank —</option>
            {bankLedgers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        {pending && <span className="text-[11px] text-[#5B4412]">working…</span>}
      </div>
      {bankLedgers.length === 0 && <p className="rounded bg-amber-100 px-2 py-1 text-[12px] text-amber-800">No bank ledgers yet — create a ledger under “Bank Accounts” or “Bank OD A/c” first (press L).</p>}
      {!ledgerId && bankLedgers.length > 0 && <p className="text-[12px] text-[#5B4412]">Choose a bank ledger above to reconcile. Set the bank date on each entry as it appears on your statement; the balance as per bank updates as you go.</p>}
      {recon && 'error' in recon && <p className="text-rose-700">{recon.error}</p>}
      {recon && 'ok' in recon && (
        <>
          <div className="mb-3 grid gap-2 sm:grid-cols-3 text-[12px]">
            <div className="rounded border border-[#0f2038]/30 bg-white/50 p-2"><p className="text-[#5B4412]">Balance as per books</p><p className="text-[15px] font-bold tabular-nums">₹ {inr(recon.bookBalance)} {recon.bookSide}</p></div>
            <div className="rounded border border-[#0f2038]/30 bg-white/50 p-2"><p className="text-[#5B4412]">Not yet cleared</p><p className="tabular-nums">Dr ₹ {inr(recon.unclearedDebit)}</p><p className="tabular-nums">Cr ₹ {inr(recon.unclearedCredit)}</p></div>
            <div className="rounded border-2 border-[#1B2A4A] bg-white/70 p-2"><p className="text-[#5B4412]">Balance as per bank</p><p className="text-[15px] font-bold tabular-nums">₹ {inr(recon.bankBalance)} {recon.bankSide}</p></div>
          </div>
          <table className="w-full border-collapse text-[12px]">
            <thead><tr className="bg-[#1B2A4A] text-left text-white"><th className="p-1">Date</th><th className="p-1">Voucher</th><th className="p-1">Particulars</th><th className="p-1 text-right">Withdrawal</th><th className="p-1 text-right">Deposit</th><th className="p-1">Bank date (cleared)</th></tr></thead>
            <tbody>
              {recon.rows.length === 0 ? <tr><td colSpan={6} className="p-4 text-center text-[#5B4412]">No entries in this bank ledger yet.</td></tr> : recon.rows.map((r) => (
                <tr key={r.lineId} className={`border-b border-[#0f2038]/20 ${r.clearedDate ? 'bg-emerald-50' : ''}`}>
                  <td className="whitespace-nowrap p-1">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                  <td className="p-1">{r.type} #{r.number}</td>
                  <td className="p-1">{r.particulars}</td>
                  <td className="p-1 text-right tabular-nums">{r.credit ? inr(r.credit) : ''}</td>
                  <td className="p-1 text-right tabular-nums">{r.debit ? inr(r.debit) : ''}</td>
                  <td className="p-1">
                    <div className="flex items-center gap-1">
                      <input type="date" value={r.clearedDate ? r.clearedDate.slice(0, 10) : ''} onChange={(e) => onSetCleared(r.lineId, e.target.value ? new Date(e.target.value).toISOString() : null)} disabled={pending} className={cls} />
                      {r.clearedDate && <button onClick={() => onSetCleared(r.lineId, null)} disabled={pending} className="text-rose-700 hover:underline" title="Un-clear">✕</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-[#5B4412]">Set a bank date to mark an entry as cleared. “Balance as per bank” counts only cleared entries — it should match your bank statement once everything on the statement is dated.</p>
        </>
      )}
    </Panel>
  );
}

function BackBtn({ onBack }: { onBack: () => void }) {
  return <button onClick={onBack} className="mb-2 rounded border border-[#0f2038]/40 px-3 py-1 text-[12px] hover:bg-white/60">← Esc — Gateway</button>;
}

function ReportBar({ onBack, onPdf, onExcel }: { onBack: () => void; onPdf: () => void; onExcel: () => void }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <button onClick={onBack} className="rounded border border-[#0f2038]/40 px-3 py-1 text-[12px] hover:bg-white/60">← Esc — Gateway</button>
      <div className="ml-auto flex gap-2">
        <button onClick={onPdf} className="rounded bg-[#1B2A4A] px-3 py-1 text-[12px] font-semibold text-white">Print (PDF)</button>
        <button onClick={onExcel} className="rounded border border-[#0f2038]/40 bg-white/70 px-3 py-1 text-[12px] hover:bg-white">Excel</button>
      </div>
    </div>
  );
}

function sumNature(data: TallyData, nature: 'INCOME' | 'EXPENSE'): number {
  return data.ledgers.filter((l) => l.nature === nature).reduce((s, l) => s + l.balance, 0);
}

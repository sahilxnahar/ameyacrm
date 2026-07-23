'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { GROUP_NAMES, VOUCHER_TYPES, VOUCHER_KEY, natureOfGroup, type VoucherType } from '@/config/tally-groups';
import { createTallyLedger, createTallyVoucher, deleteTallyVoucher, deleteTallyLedger, createTallyStockItem, createTallyItemInvoice, deleteTallyStockItem, tallyStatementPdf } from '@/server/actions/tally';
import { exportXlsx } from '@/lib/export/xlsx';
import type { TallyData } from '@/server/services/tally-service';

type StmtKind = 'trial' | 'pl' | 'bs' | 'stock';

type Screen = 'gateway' | 'voucher' | 'invoice' | 'daybook' | 'trial' | 'pl' | 'balsheet' | 'ledgers' | 'createLedger' | 'stock' | 'createStock' | 'stockSummary';
const inr = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);

interface Line { ledgerId: string; debit: string; credit: string }

export function TallyApp({ data }: { data: TallyData }) {
  const router = useRouter();
  const [screen, setScreen] = React.useState<Screen>('gateway');
  const [pending, start] = React.useTransition();

  // Voucher entry state
  const [vType, setVType] = React.useState<VoucherType>('Payment');
  const [vDate, setVDate] = React.useState(todayISO());
  const [vNarr, setVNarr] = React.useState('');
  const [lines, setLines] = React.useState<Line[]>([{ ledgerId: '', debit: '', credit: '' }, { ledgerId: '', debit: '', credit: '' }]);

  // Item-invoice (Sales/Purchase) state
  const [invType, setInvType] = React.useState<'Sales' | 'Purchase'>('Sales');
  const [invParty, setInvParty] = React.useState('');
  const [invItems, setInvItems] = React.useState<Array<{ itemId: string; qty: string; rate: string }>>([{ itemId: '', qty: '', rate: '' }]);

  const back = () => setScreen('gateway');

  const openVoucher = (t: VoucherType) => {
    if (t === 'Sales' || t === 'Purchase') {
      setInvType(t); setVDate(todayISO()); setVNarr(''); setInvParty(''); setInvItems([{ itemId: '', qty: '', rate: '' }]);
      setScreen('invoice');
      return;
    }
    setVType(t); setVDate(todayISO()); setVNarr(''); setLines([{ ledgerId: '', debit: '', credit: '' }, { ledgerId: '', debit: '', credit: '' }]); setScreen('voucher');
  };

  // Global keyboard: Esc = back; F4–F9 open a voucher from anywhere.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (screen !== 'gateway') { e.preventDefault(); back(); } return; }
      const vk = (Object.entries(VOUCHER_KEY) as Array<[VoucherType, string]>).find(([, k]) => k === e.key);
      if (vk) { e.preventDefault(); openVoucher(vk[0]); return; }
      if (screen === 'gateway') {
        const map: Record<string, Screen> = { v: 'voucher', d: 'daybook', t: 'trial', b: 'balsheet', p: 'pl', l: 'ledgers', i: 'stock', s: 'stockSummary' };
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
    start(async () => {
      const r = await createTallyVoucher({ type: vType, date: vDate, narration: vNarr || undefined, lines: lines.filter((l) => l.ledgerId && (Number(l.debit) || Number(l.credit))).map((l) => ({ ledgerId: l.ledgerId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })) });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`${vType} voucher posted`); router.refresh(); back();
    });
  };

  const removeVoucher = (id: string) => start(async () => {
    const r = await deleteTallyVoucher(id);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Voucher deleted'); router.refresh();
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
      const r = await createTallyItemInvoice({ type: invType, date: vDate, partyLedgerId: invParty, narration: vNarr || undefined, items: rows.map((l) => ({ itemId: l.itemId, qty: Number(l.qty), rate: Number(l.rate) || 0 })) });
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
    const r = await tallyStatementPdf(kind);
    if ('error' in r) { toast.error(r.error); return; }
    const a = document.createElement('a'); a.href = `data:application/pdf;base64,${r.pdfBase64}`; a.download = r.filename; a.click();
    toast.success('PDF downloaded');
  });
  const exportExcel = (kind: StmtKind) => {
    if (kind === 'trial') exportXlsx('Tally-Trial-Balance', 'Trial Balance', data.trial.rows.map((r) => ({ Ledger: r.name, Group: r.group, Debit: r.debit, Credit: r.credit })));
    else if (kind === 'stock') exportXlsx('Tally-Stock-Summary', 'Stock Summary', data.stock.map((s) => ({ Item: s.name, Unit: s.unit, Inward: s.inQty, Outward: s.outQty, Closing: s.closingQty, Rate: s.rate, Value: s.value })));
    else if (kind === 'pl') exportXlsx('Tally-Profit-and-Loss', 'P&L', data.ledgers.filter((l) => (l.nature === 'INCOME' || l.nature === 'EXPENSE') && l.balance !== 0).map((l) => ({ Section: l.nature === 'INCOME' ? 'Income' : 'Expense', Ledger: l.name, Amount: l.balance })));
    else exportXlsx('Tally-Balance-Sheet', 'Balance Sheet', data.ledgers.filter((l) => (l.nature === 'ASSET' || l.nature === 'LIABILITY') && l.balance !== 0).map((l) => ({ Section: l.nature === 'ASSET' ? 'Asset' : 'Liability', Ledger: l.name, Amount: l.balance })));
    toast.success('Excel downloaded');
  };

  return (
    <div className="tally-wrap min-h-[calc(100vh-9rem)] overflow-hidden rounded-lg border-2 border-[#0f2038] font-mono text-[13px] text-[#0f2038]" style={{ background: '#dfe6ee' }}>
      {/* Title bar */}
      <div className="flex items-center justify-between bg-[#1B2A4A] px-3 py-1.5 text-[#E9D9A8]">
        <span className="font-semibold tracking-wide">AMEYA TALLY</span>
        <span className="text-xs">Ameya Heights LLP · {data.totals.ledgers} ledgers · {data.totals.vouchers} vouchers</span>
        <span className="text-xs">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
      </div>

      <div className="flex">
        <div className="min-h-[70vh] flex-1 p-4">
          {screen === 'gateway' && <Gateway onGo={(s) => { if (s === 'voucher') openVoucher('Payment'); else setScreen(s); }} data={data} />}
          {screen === 'voucher' && (
            <VoucherEntry
              type={vType} setType={setVType} date={vDate} setDate={setVDate} narr={vNarr} setNarr={setVNarr}
              lines={lines} setLines={setLines} ledgers={data.ledgers} totalDr={totalDr} totalCr={totalCr} diff={diff} balanced={balanced}
              onSave={saveVoucher} onBack={back} pending={pending} openVoucher={openVoucher}
            />
          )}
          {screen === 'invoice' && (
            <ItemInvoice
              type={invType} setType={(t) => { setInvType(t); }} date={vDate} setDate={setVDate} narr={vNarr} setNarr={setVNarr}
              party={invParty} setParty={setInvParty} items={invItems} setItems={setInvItems}
              ledgers={data.ledgers} stock={data.stock} taxable={invTaxable} gst={invGst} total={invTotal}
              onSave={saveInvoice} onBack={back} pending={pending} onNewItem={() => setScreen('createStock')}
            />
          )}
          {screen === 'stock' && <StockItems data={data} onBack={back} onCreate={() => setScreen('createStock')} onDelete={removeStock} pending={pending} />}
          {screen === 'createStock' && <CreateStock onDone={() => { router.refresh(); setScreen('stock'); }} onBack={() => setScreen('stock')} />}
          {screen === 'stockSummary' && <StockSummary data={data} onBack={back} onPdf={() => exportPdf('stock')} onExcel={() => exportExcel('stock')} />}
          {screen === 'daybook' && <DayBook data={data} onBack={back} onDelete={removeVoucher} pending={pending} />}
          {screen === 'trial' && <TrialBalance data={data} onBack={back} onPdf={() => exportPdf('trial')} onExcel={() => exportExcel('trial')} />}
          {screen === 'pl' && <ProfitLoss data={data} onBack={back} onPdf={() => exportPdf('pl')} onExcel={() => exportExcel('pl')} />}
          {screen === 'balsheet' && <BalanceSheet data={data} onBack={back} onPdf={() => exportPdf('bs')} onExcel={() => exportExcel('bs')} />}
          {screen === 'ledgers' && <Ledgers data={data} onBack={back} onCreate={() => setScreen('createLedger')} onDelete={(id) => start(async () => { const r = await deleteTallyLedger(id); if ('error' in r) { toast.error(r.error); return; } toast.success('Ledger deleted'); router.refresh(); })} pending={pending} />}
          {screen === 'createLedger' && <CreateLedger onDone={() => { router.refresh(); setScreen('ledgers'); }} onBack={() => setScreen('ledgers')} />}
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
          <div className="pt-2 text-[10px] font-semibold text-[#5B4412]">MASTERS</div>
          <BarBtn label="Ledgers" k="L" onClick={() => setScreen('ledgers')} />
          <BarBtn label="Stock Items" k="I" onClick={() => setScreen('stock')} />
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

function Gateway({ onGo, data }: { onGo: (s: Screen) => void; data: TallyData }) {
  const income = sumNature(data, 'INCOME');
  const expense = sumNature(data, 'EXPENSE');
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
  onSave: () => void; onBack: () => void; pending: boolean; openVoucher: (t: VoucherType) => void;
}) {
  const { type, date, setDate, narr, setNarr, lines, setLines, ledgers, totalDr, totalCr, diff, balanced, onSave, onBack, pending, openVoucher } = props;
  const setLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines([...lines, { ledgerId: '', debit: '', credit: '' }]);
  const removeLine = (i: number) => setLines(lines.length > 2 ? lines.filter((_, j) => j !== i) : lines);
  const cls = 'border border-[#0f2038]/40 bg-white px-2 py-1 text-[13px]';

  return (
    <Panel title={`${type} Voucher`}>
      <div className="mb-2 flex flex-wrap gap-1">
        {VOUCHER_TYPES.map((t) => (
          <button key={t} onClick={() => openVoucher(t)} className={`rounded px-2 py-0.5 text-[11px] ${t === type ? 'bg-[#1B2A4A] text-white' : 'bg-white/70 hover:bg-white'}`}>
            {t} <kbd className="text-[#8C6E2C]">{VOUCHER_KEY[t]}</kbd>
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1">Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cls} /></label>
        <label className="flex flex-1 items-center gap-1">Narration <input value={narr} onChange={(e) => setNarr(e.target.value)} placeholder="Being…" className={`${cls} min-w-[12rem] flex-1`} /></label>
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

function DayBook({ data, onBack, onDelete, pending }: { data: TallyData; onBack: () => void; onDelete: (id: string) => void; pending: boolean }) {
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
                <td className="p-1"><button onClick={() => onDelete(v.id)} disabled={pending} className="text-rose-700 hover:underline">del</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function TrialBalance({ data, onBack, onPdf, onExcel }: { data: TallyData; onBack: () => void; onPdf: () => void; onExcel: () => void }) {
  return (
    <Panel title="Trial Balance">
      <ReportBar onBack={onBack} onPdf={onPdf} onExcel={onExcel} />
      <table className="w-full border-collapse text-[12px]">
        <thead><tr className="bg-[#1B2A4A] text-left text-white"><th className="p-1">Ledger</th><th className="p-1">Group</th><th className="p-1 text-right">Debit</th><th className="p-1 text-right">Credit</th></tr></thead>
        <tbody>
          {data.trial.rows.map((r) => (
            <tr key={r.name} className="border-b border-[#0f2038]/20"><td className="p-1">{r.name}</td><td className="p-1 text-[#5B4412]">{r.group}</td><td className="p-1 text-right tabular-nums">{r.debit ? inr(r.debit) : ''}</td><td className="p-1 text-right tabular-nums">{r.credit ? inr(r.credit) : ''}</td></tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t-2 border-[#0f2038] font-bold"><td className="p-1" colSpan={2}>Total</td><td className="p-1 text-right tabular-nums">{inr(data.trial.totalDebit)}</td><td className="p-1 text-right tabular-nums">{inr(data.trial.totalCredit)}</td></tr></tfoot>
      </table>
      <p className={`mt-2 text-[12px] font-semibold ${data.trial.balanced ? 'text-emerald-700' : 'text-rose-700'}`}>{data.trial.balanced ? 'Balanced ✓' : 'OUT OF BALANCE'}</p>
    </Panel>
  );
}

function ProfitLoss({ data, onBack, onPdf, onExcel }: { data: TallyData; onBack: () => void; onPdf: () => void; onExcel: () => void }) {
  const income = data.ledgers.filter((l) => l.nature === 'INCOME' && l.balance !== 0);
  const expense = data.ledgers.filter((l) => l.nature === 'EXPENSE' && l.balance !== 0);
  const ti = income.reduce((s, l) => s + l.balance, 0);
  const te = expense.reduce((s, l) => s + l.balance, 0);
  const profit = ti - te;
  return (
    <Panel title="Profit & Loss A/c">
      <ReportBar onBack={onBack} onPdf={onPdf} onExcel={onExcel} />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatementCol title="Expenses (Dr)" rows={expense} total={te} extraLabel={profit >= 0 ? 'Net Profit' : undefined} extra={profit >= 0 ? profit : undefined} />
        <StatementCol title="Income (Cr)" rows={income} total={ti} extraLabel={profit < 0 ? 'Net Loss' : undefined} extra={profit < 0 ? -profit : undefined} />
      </div>
      <p className={`mt-3 text-center text-[13px] font-bold ${profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{profit >= 0 ? 'Net Profit' : 'Net Loss'}: ₹ {inr(Math.abs(profit))}</p>
    </Panel>
  );
}

function BalanceSheet({ data, onBack, onPdf, onExcel }: { data: TallyData; onBack: () => void; onPdf: () => void; onExcel: () => void }) {
  const assets = data.ledgers.filter((l) => l.nature === 'ASSET' && l.balance !== 0);
  const liabilities = data.ledgers.filter((l) => l.nature === 'LIABILITY' && l.balance !== 0);
  const profit = sumNature(data, 'INCOME') - sumNature(data, 'EXPENSE');
  const ta = assets.reduce((s, l) => s + l.balance, 0);
  const tl = liabilities.reduce((s, l) => s + l.balance, 0) + profit;
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

function StatementCol({ title, rows, total, extraLabel, extra }: { title: string; rows: TallyData['ledgers']; total: number; extraLabel?: string; extra?: number }) {
  return (
    <div className="rounded border border-[#0f2038]/30 bg-white/50 p-2">
      <p className="mb-1 border-b border-[#0f2038]/30 pb-1 font-bold">{title}</p>
      {rows.map((r) => <div key={r.id} className="flex justify-between py-0.5"><span>{r.name}</span><span className="tabular-nums">{inr(r.balance)}</span></div>)}
      {extraLabel && extra != null && <div className="flex justify-between py-0.5 italic"><span>{extraLabel}</span><span className="tabular-nums">{inr(extra)}</span></div>}
      <div className="mt-1 flex justify-between border-t-2 border-[#0f2038] pt-1 font-bold"><span>Total</span><span className="tabular-nums">{inr(total)}</span></div>
    </div>
  );
}

function Ledgers({ data, onBack, onCreate, onDelete, pending }: { data: TallyData; onBack: () => void; onCreate: () => void; onDelete: (id: string) => void; pending: boolean }) {
  return (
    <Panel title="Ledgers">
      <div className="mb-2 flex items-center gap-2"><BackBtn onBack={onBack} /><button onClick={onCreate} className="rounded bg-[#1B2A4A] px-3 py-1 text-[12px] font-semibold text-white">Create ledger (L)</button></div>
      <table className="w-full border-collapse text-[12px]">
        <thead><tr className="bg-[#1B2A4A] text-left text-white"><th className="p-1">Name</th><th className="p-1">Group</th><th className="p-1 text-right">Balance</th><th /></tr></thead>
        <tbody>
          {data.ledgers.map((l) => (
            <tr key={l.id} className="border-b border-[#0f2038]/20"><td className="p-1">{l.name}{l.isSystem && <span className="ml-1 text-[10px] text-[#8C6E2C]">(system)</span>}</td><td className="p-1 text-[#5B4412]">{l.group}</td><td className="p-1 text-right tabular-nums">{inr(l.balance)} {l.side}</td><td className="p-1">{!l.isSystem && <button onClick={() => onDelete(l.id)} disabled={pending} className="text-rose-700 hover:underline">del</button>}</td></tr>
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
  onSave: () => void; onBack: () => void; pending: boolean; onNewItem: () => void;
}) {
  const { type, setType, date, setDate, narr, setNarr, party, setParty, items, setItems, ledgers, stock, taxable, gst, total, onSave, onBack, pending, onNewItem } = props;
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

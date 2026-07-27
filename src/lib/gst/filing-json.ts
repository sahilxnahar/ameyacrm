/**
 * Offline, filing-ready GST JSON generators — the "connected Tally / GST tier".
 *
 * These build the JSON structures the government portals and the GST offline
 * tool accept, straight from the CRM's own invoices. Nothing is transmitted:
 * the user downloads the file and uploads it to the GST portal, the e-invoice
 * (IRP) portal or the e-way-bill portal — or imports it into Tally. That keeps
 * the CRM out of scope for a GSP licence while still removing the re-typing.
 *
 * Pure functions, no database and no server-only imports, so they unit-test
 * cleanly. Always have a CA/GST practitioner review before filing — these follow
 * the published schemas but cannot know every scheme-specific nuance of a book.
 */

export interface FilingInvoiceItem {
  description: string;
  hsnSac: string | null;
  quantity: number;
  rate: number;
  gstRate: number;   // percent
  amount: number;    // taxable value (qty × rate)
}

export interface FilingInvoice {
  number: string;
  issueDate: string;      // ISO
  clientName: string;
  clientGstin: string | null;
  clientStateCode: string | null; // 2-digit; falls back to seller state for intra
  subTotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  items: FilingInvoiceItem[];
}

export interface Seller {
  gstin: string;          // 15-char; first 2 = state code
  legalName: string;
  address: string;
  stateCode: string;      // 2-digit
  pincode?: string;
}

/** The 2-digit state code that prefixes every GSTIN. */
export function stateCodeOf(gstin: string | null | undefined): string {
  const s = (gstin ?? '').trim();
  return /^\d{2}/.test(s) ? s.slice(0, 2) : '';
}

function r2(x: number): number {
  return Math.round(x * 100) / 100;
}

function ddmmyyyy(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

function isInterState(seller: Seller, inv: FilingInvoice): boolean {
  const buyer = inv.clientStateCode || stateCodeOf(inv.clientGstin);
  return !!buyer && buyer !== seller.stateCode;
}

/**
 * GSTR-1 JSON in the GST offline-tool shape: gstin, fp (filing period MMYYYY),
 * b2b (registered buyers), b2cs (unregistered, rate-wise), hsn summary.
 */
export function buildGstr1Json(seller: Seller, invoices: FilingInvoice[], period: { month: number; year: number }): object {
  const fp = `${String(period.month).padStart(2, '0')}${period.year}`;

  // B2B — grouped by buyer GSTIN.
  const b2bMap = new Map<string, FilingInvoice[]>();
  const b2c: FilingInvoice[] = [];
  for (const inv of invoices) {
    if (inv.clientGstin && /^\d{2}[A-Z0-9]{13}$/i.test(inv.clientGstin.trim())) {
      const g = inv.clientGstin.trim().toUpperCase();
      (b2bMap.get(g) ?? b2bMap.set(g, []).get(g)!).push(inv);
    } else {
      b2c.push(inv);
    }
  }

  const b2b = [...b2bMap.entries()].map(([ctin, invs]) => ({
    ctin,
    inv: invs.map((inv) => {
      const inter = isInterState(seller, inv);
      const pos = (inv.clientStateCode || stateCodeOf(inv.clientGstin) || seller.stateCode);
      return {
        inum: inv.number,
        idt: ddmmyyyy(inv.issueDate),
        val: r2(inv.total),
        pos,
        rchrg: 'N',
        inv_typ: 'R',
        itms: rateWiseItems(inv, inter),
      };
    }),
  }));

  // B2CS — small unregistered, aggregated by (place of supply, rate).
  const b2csMap = new Map<string, { pos: string; rate: number; txval: number; iamt: number; camt: number; samt: number }>();
  for (const inv of b2c) {
    const inter = isInterState(seller, inv);
    const pos = inv.clientStateCode || seller.stateCode;
    for (const it of inv.items) {
      const key = `${pos}|${it.gstRate}`;
      const tax = (it.amount * it.gstRate) / 100;
      const e = b2csMap.get(key) ?? { pos, rate: it.gstRate, txval: 0, iamt: 0, camt: 0, samt: 0 };
      e.txval += it.amount;
      if (inter) e.iamt += tax; else { e.camt += tax / 2; e.samt += tax / 2; }
      b2csMap.set(key, e);
    }
  }
  const b2cs = [...b2csMap.values()].map((e) => ({
    sply_ty: e.pos === seller.stateCode ? 'INTRA' : 'INTER',
    pos: e.pos,
    typ: 'OE',
    rt: e.rate,
    txval: r2(e.txval),
    iamt: r2(e.iamt),
    camt: r2(e.camt),
    samt: r2(e.samt),
    csamt: 0,
  }));

  // HSN summary (table 12).
  const hsnMap = new Map<string, { hsn: string; rate: number; qty: number; txval: number; iamt: number; camt: number; samt: number }>();
  for (const inv of invoices) {
    const inter = isInterState(seller, inv);
    for (const it of inv.items) {
      const key = `${it.hsnSac || ''}|${it.gstRate}`;
      const tax = (it.amount * it.gstRate) / 100;
      const e = hsnMap.get(key) ?? { hsn: it.hsnSac || '', rate: it.gstRate, qty: 0, txval: 0, iamt: 0, camt: 0, samt: 0 };
      e.qty += it.quantity;
      e.txval += it.amount;
      if (inter) e.iamt += tax; else { e.camt += tax / 2; e.samt += tax / 2; }
      hsnMap.set(key, e);
    }
  }
  const hsnData = [...hsnMap.values()].map((e, i) => ({
    num: i + 1,
    hsn_sc: e.hsn,
    uqc: 'OTH',
    qty: r2(e.qty),
    rt: e.rate,
    txval: r2(e.txval),
    iamt: r2(e.iamt),
    camt: r2(e.camt),
    samt: r2(e.samt),
    csamt: 0,
  }));

  return {
    gstin: seller.gstin,
    fp,
    version: 'GST3.2',
    hash: 'hash',
    b2b,
    b2cs,
    hsn: { data: hsnData },
  };
}

function rateWiseItems(inv: FilingInvoice, inter: boolean) {
  const byRate = new Map<number, number>();
  for (const it of inv.items) byRate.set(it.gstRate, (byRate.get(it.gstRate) ?? 0) + it.amount);
  return [...byRate.entries()].map(([rate, txval], i) => {
    const tax = (txval * rate) / 100;
    return {
      num: i + 1,
      itm_det: {
        rt: rate,
        txval: r2(txval),
        iamt: inter ? r2(tax) : 0,
        camt: inter ? 0 : r2(tax / 2),
        samt: inter ? 0 : r2(tax / 2),
        csamt: 0,
      },
    };
  });
}

/**
 * E-invoice (IRN) JSON per the NIC schema (version 1.1) for one invoice. The
 * seller uploads this to the IRP to get the IRN and signed QR.
 */
export function buildEInvoiceJson(seller: Seller, inv: FilingInvoice): object {
  const inter = isInterState(seller, inv);
  const buyerState = inv.clientStateCode || stateCodeOf(inv.clientGstin) || seller.stateCode;
  const totItem = inv.items.reduce((a, it) => a + it.amount, 0);
  const totTax = (inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0);
  return {
    Version: '1.1',
    TranDtls: { TaxSch: 'GST', SupTyp: inv.clientGstin ? 'B2B' : 'B2C', RegRev: 'N' },
    DocDtls: { Typ: 'INV', No: inv.number, Dt: ddmmyyyy(inv.issueDate) },
    SellerDtls: {
      Gstin: seller.gstin, LglNm: seller.legalName, Addr1: seller.address.slice(0, 100),
      Loc: 'NA', Pin: Number(seller.pincode || '000000'), Stcd: seller.stateCode,
    },
    BuyerDtls: {
      Gstin: inv.clientGstin || 'URP', LglNm: inv.clientName, Pos: buyerState,
      Addr1: 'NA', Loc: 'NA', Pin: 999999, Stcd: buyerState,
    },
    ItemList: inv.items.map((it, i) => {
      const tax = (it.amount * it.gstRate) / 100;
      return {
        SlNo: String(i + 1),
        PrdDesc: it.description.slice(0, 300),
        IsServc: it.hsnSac && it.hsnSac.length >= 6 && it.hsnSac.startsWith('99') ? 'Y' : 'N',
        HsnCd: it.hsnSac || '',
        Qty: r2(it.quantity),
        Unit: 'OTH',
        UnitPrice: r2(it.rate),
        TotAmt: r2(it.amount),
        AssAmt: r2(it.amount),
        GstRt: it.gstRate,
        IgstAmt: inter ? r2(tax) : 0,
        CgstAmt: inter ? 0 : r2(tax / 2),
        SgstAmt: inter ? 0 : r2(tax / 2),
        TotItemVal: r2(it.amount + tax),
      };
    }),
    ValDtls: {
      AssVal: r2(totItem),
      IgstVal: r2(inv.igst || 0),
      CgstVal: r2(inv.cgst || 0),
      SgstVal: r2(inv.sgst || 0),
      TotInvVal: r2(totItem + totTax),
    },
  };
}

/**
 * E-way-bill JSON (bulk-generation shape) for one invoice. Distance/transport
 * details are left for the user to complete on the portal, since they are not
 * known to the CRM at invoice time.
 */
export function buildEwayBillJson(seller: Seller, inv: FilingInvoice): object {
  const inter = isInterState(seller, inv);
  const buyerState = inv.clientStateCode || stateCodeOf(inv.clientGstin) || seller.stateCode;
  const totTax = (inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0);
  const totTaxable = inv.items.reduce((a, it) => a + it.amount, 0);
  return {
    version: '1.0.0621',
    billLists: [{
      userGstin: seller.gstin,
      supplyType: 'O',
      subSupplyType: '1',
      docType: 'INV',
      docNo: inv.number,
      docDate: ddmmyyyy(inv.issueDate),
      fromGstin: seller.gstin,
      fromTrdName: seller.legalName,
      fromStateCode: Number(seller.stateCode),
      actFromStateCode: Number(seller.stateCode),
      toGstin: inv.clientGstin || 'URP',
      toTrdName: inv.clientName,
      toStateCode: Number(buyerState),
      actToStateCode: Number(buyerState),
      transactionType: 1,
      totalValue: r2(totTaxable),
      cgstValue: r2(inv.cgst || 0),
      sgstValue: r2(inv.sgst || 0),
      igstValue: r2(inv.igst || 0),
      cessValue: 0,
      totInvValue: r2(totTaxable + totTax),
      itemList: inv.items.map((it, i) => {
        const tax = (it.amount * it.gstRate) / 100;
        return {
          itemNo: i + 1,
          productName: it.description.slice(0, 100),
          hsnCode: Number(it.hsnSac || 0) || it.hsnSac || '',
          quantity: r2(it.quantity),
          qtyUnit: 'OTH',
          taxableAmount: r2(it.amount),
          igstRate: inter ? it.gstRate : 0,
          cgstRate: inter ? 0 : it.gstRate / 2,
          sgstRate: inter ? 0 : it.gstRate / 2,
          cessRate: 0,
          cessAdvol: 0,
        };
      }),
    }],
  };
}

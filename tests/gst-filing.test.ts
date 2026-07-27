import { describe, it, expect } from 'vitest';
import { buildGstr1Json, buildEInvoiceJson, buildEwayBillJson, stateCodeOf, type Seller, type FilingInvoice } from '@/lib/gst/filing-json';

const seller: Seller = { gstin: '29ACOFA6794K1ZG', legalName: 'Ameya Heights LLP', address: 'Chennai', stateCode: '29' };

function inv(over: Partial<FilingInvoice> = {}): FilingInvoice {
  return {
    number: 'INV-2026-0001', issueDate: '2026-07-10T00:00:00.000Z',
    clientName: 'Acme Pvt Ltd', clientGstin: '29ABCDE1234F1Z5', clientStateCode: '29',
    subTotal: 1000, cgst: 90, sgst: 90, igst: 0, total: 1180,
    items: [{ description: 'Consulting', hsnSac: '9954', quantity: 1, rate: 1000, gstRate: 18, amount: 1000 }],
    ...over,
  };
}

describe('gst filing json', () => {
  it('reads the state code off a GSTIN', () => {
    expect(stateCodeOf('29ABCDE1234F1Z5')).toBe('29');
    expect(stateCodeOf(null)).toBe('');
  });

  it('builds GSTR-1 with b2b for a registered buyer and correct intra-state tax split', () => {
    const j = buildGstr1Json(seller, [inv()], { month: 7, year: 2026 }) as any;
    expect(j.gstin).toBe(seller.gstin);
    expect(j.fp).toBe('072026');
    expect(j.b2b).toHaveLength(1);
    expect(j.b2b[0].ctin).toBe('29ABCDE1234F1Z5');
    const itm = j.b2b[0].inv[0].itms[0].itm_det;
    expect(itm.rt).toBe(18);
    expect(itm.camt).toBe(90);
    expect(itm.samt).toBe(90);
    expect(itm.iamt).toBe(0);
    expect(j.hsn.data[0].hsn_sc).toBe('9954');
  });

  it('routes an unregistered buyer to b2cs', () => {
    const j = buildGstr1Json(seller, [inv({ clientGstin: null, clientStateCode: '29' })], { month: 7, year: 2026 }) as any;
    expect(j.b2b).toHaveLength(0);
    expect(j.b2cs).toHaveLength(1);
    expect(j.b2cs[0].txval).toBe(1000);
  });

  it('uses IGST for an inter-state supply', () => {
    const j = buildGstr1Json(seller, [inv({ clientGstin: '27ABCDE1234F1Z5', clientStateCode: '27', igst: 180, cgst: 0, sgst: 0 })], { month: 7, year: 2026 }) as any;
    const itm = j.b2b[0].inv[0].itms[0].itm_det;
    expect(itm.iamt).toBe(180);
    expect(itm.camt).toBe(0);
  });

  it('builds an e-invoice payload with seller/buyer/value blocks', () => {
    const j = buildEInvoiceJson(seller, inv()) as any;
    expect(j.Version).toBe('1.1');
    expect(j.SellerDtls.Gstin).toBe(seller.gstin);
    expect(j.BuyerDtls.Gstin).toBe('29ABCDE1234F1Z5');
    expect(j.ValDtls.AssVal).toBe(1000);
    expect(j.ItemList[0].CgstAmt).toBe(90);
  });

  it('builds an e-way-bill payload', () => {
    const j = buildEwayBillJson(seller, inv()) as any;
    expect(j.billLists[0].docNo).toBe('INV-2026-0001');
    expect(j.billLists[0].fromStateCode).toBe(29);
    expect(j.billLists[0].itemList[0].cgstRate).toBe(9);
  });
});

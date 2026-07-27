import { describe, it, expect } from 'vitest';
import { parseGstrCsv } from '@/lib/import/parse-gstr';

const csv = [
  'Supplier GSTIN,Invoice No,Invoice Date,Taxable Value,IGST,CGST,SGST',
  '29ABCDE1234F1Z5,INV-001,2026-06-01,100000,0,9000,9000',
  '29ABCDE1234F1Z5,"INV,002",2026-06-02,"2,00,000",36000,0,0',
  ',,,,,,',
].join('\n');

describe('GSTR-2B CSV parser (module #52)', () => {
  it('parses rows and maps flexible headers', () => {
    const rows = parseGstrCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ supplierGstin: '29ABCDE1234F1Z5', invoiceNo: 'INV-001', taxableValue: 100000, cgst: 9000, sgst: 9000 });
  });
  it('handles quoted commas in invoice numbers and amounts', () => {
    const rows = parseGstrCsv(csv);
    expect(rows[1]!.invoiceNo).toBe('INV,002');
    expect(rows[1]!.taxableValue).toBe(200000);
    expect(rows[1]!.igst).toBe(36000);
  });
  it('skips rows with no invoice number and empty input', () => {
    expect(parseGstrCsv(csv).every((r) => r.invoiceNo)).toBe(true);
    expect(parseGstrCsv('')).toEqual([]);
    expect(parseGstrCsv('only,a,header,row')).toEqual([]);
  });
});

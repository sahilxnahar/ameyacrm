'use client';

/**
 * Read an uploaded spreadsheet into CSV text, so every import can accept Excel
 * as well as CSV. Excel files (.xlsx/.xls/.xlsm) are binary, so reading them as
 * text gives gibberish — here we convert the first sheet to CSV with SheetJS.
 * CSV / plain-text files are read as-is.
 *
 * SheetJS is loaded on demand (dynamic import), so it only ships to the browser
 * when someone actually picks an Excel file — it doesn't bloat the app otherwise.
 */
export async function readSpreadsheetAsCsv(file: File): Promise<string> {
  const name = (file.name || '').toLowerCase();
  if (/\.(xlsx|xls|xlsm|xlsb|ods)$/.test(name)) {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const first = wb.SheetNames[0];
    const ws = first ? wb.Sheets[first] : undefined;
    return ws ? XLSX.utils.sheet_to_csv(ws) : '';
  }
  return await file.text();
}

/** The accept string for any import that now takes CSV or Excel. */
export const SPREADSHEET_ACCEPT = '.csv,.xlsx,.xls,.xlsm,.xlsb,.ods,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

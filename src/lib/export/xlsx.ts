'use client';

/**
 * Download a real .xlsx file from an array of plain objects. SheetJS is already
 * bundled for imports, so this reuses it — loaded on demand so it only ships to
 * the browser when someone actually exports.
 */
export async function exportXlsx(filename: string, sheetName: string, rows: Record<string, unknown>[]): Promise<void> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || 'Sheet1');
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

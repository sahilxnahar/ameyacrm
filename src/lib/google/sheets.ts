import 'server-only';
import { env } from '@/config/env';
import { getGoogleAccessToken } from './auth';
import { isAppsScriptConfigured, gasSheet } from './appscript';

export function isSheetsConfigured(): boolean {
  return isAppsScriptConfigured() || Boolean(env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_PRIVATE_KEY && env.GOOGLE_SHEETS_ID);
}

/** Replace a tab's contents with header + rows. Creates the tab if missing. */
export async function writeSheet(tabName: string, header: string[], rows: (string | number)[][]): Promise<{ ok: true; rows: number } | { error: string }> {
  if (isAppsScriptConfigured()) {
    const r = await gasSheet(tabName, header, rows);
    return 'error' in r ? r : { ok: true, rows: r.rows };
  }
  if (!isSheetsConfigured()) return { error: 'Google Sheets is not connected. Set GAS_WEBAPP_URL + GAS_SECRET in Vercel (no Cloud Console needed).' };
  const token = await getGoogleAccessToken();
  if (!token) return { error: 'Google authentication failed — check the service-account email and private key.' };
  const id = env.GOOGLE_SHEETS_ID!;
  const auth = { Authorization: `Bearer ${token}` };
  // Create the tab if it doesn't exist (ignore "already exists").
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tabName } } }] }),
    });
  } catch { /* tab probably exists */ }
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(tabName)}:clear`, { method: 'POST', headers: auth });
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(`${tabName}!A1`)}?valueInputOption=RAW`, {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [header, ...rows] }),
    });
    if (!res.ok) return { error: `Sheets write failed (${res.status}). Make sure the sheet is shared with ${env.GOOGLE_SERVICE_ACCOUNT_EMAIL} as an Editor.` };
    return { ok: true, rows: rows.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Sheets write failed.' };
  }
}

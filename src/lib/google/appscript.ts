import 'server-only';
import { env } from '@/config/env';

/**
 * Talks to a Google Apps Script Web App that YOU own and deploy ("Execute as: Me").
 * Files land in your personal Drive under your own storage quota — no Cloud Console,
 * no service account, no API keys, no billing.
 */
export function isAppsScriptConfigured(): boolean {
  return Boolean(env.GAS_WEBAPP_URL && env.GAS_SECRET);
}

const MAX_BYTES = 8 * 1024 * 1024; // Apps Script payload ceiling (base64 inflates ~33%)

async function call<T>(payload: Record<string, unknown>): Promise<T | { error: string }> {
  if (!isAppsScriptConfigured()) return { error: 'Google connector not set up. Add GAS_WEBAPP_URL and GAS_SECRET in Vercel.' };
  try {
    const res = await fetch(env.GAS_WEBAPP_URL!, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'follow',
      body: JSON.stringify({ secret: env.GAS_SECRET, ...payload }),
    });
    const text = await res.text();
    try {
      const j = JSON.parse(text) as T & { error?: string };
      if (j.error) return { error: j.error };
      return j;
    } catch {
      return { error: `Google connector returned an unexpected response (${res.status}). Re-deploy the Apps Script with access set to "Anyone".` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Google connector unreachable.' };
  }
}

export async function gasUpload(name: string, mimeType: string, body: Buffer): Promise<{ id: string; url: string } | { error: string }> {
  if (body.length > MAX_BYTES) return { error: `File is too large for the Google connector (${Math.round(body.length / 1048576)}MB; limit 8MB). It stays in the CRM.` };
  return call<{ id: string; url: string }>({ action: 'upload', name, mimeType, data: body.toString('base64') });
}

export async function gasSheet(tab: string, header: string[], rows: (string | number)[][]): Promise<{ rows: number } | { error: string }> {
  return call<{ rows: number }>({ action: 'sheet', tab, header, rows });
}

export async function gasPing(): Promise<{ folder: string } | { error: string }> {
  return call<{ folder: string }>({ action: 'ping' });
}

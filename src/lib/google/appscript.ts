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

export async function gasUpload(
  name: string,
  mimeType: string,
  body: Buffer,
  folderPath: string[] = [],
): Promise<{ id: string; url: string; folderId?: string } | { error: string }> {
  if (body.length > MAX_BYTES) return { error: `File is too large for the Google connector (${Math.round(body.length / 1048576)}MB; limit 8MB). It stays in the CRM.` };
  // folderPath mirrors the CRM's folder tree inside Drive, creating any part
  // that does not exist yet.
  return call<{ id: string; url: string; folderId?: string }>({
    action: 'upload', name, mimeType, folderPath, data: body.toString('base64'),
  });
}

/** Create (or find) a folder path in Drive without uploading anything. */
export async function gasFolder(folderPath: string[]): Promise<{ id: string; name: string } | { error: string }> {
  return call<{ id: string; name: string }>({ action: 'folder', folderPath });
}

/** Everything currently sitting in the Drive folder tree, for the reverse sync. */
export async function gasList(folderPath: string[] = []): Promise<{ files: Array<{ id: string; name: string; mimeType: string; size: number; url: string; path: string[] }> } | { error: string }> {
  return call<{ files: Array<{ id: string; name: string; mimeType: string; size: number; url: string; path: string[] }> }>({ action: 'list', folderPath });
}

export async function gasSheet(tab: string, header: string[], rows: (string | number)[][]): Promise<{ rows: number } | { error: string }> {
  return call<{ rows: number }>({ action: 'sheet', tab, header, rows });
}

export async function gasPing(): Promise<{ folder: string } | { error: string }> {
  return call<{ folder: string }>({ action: 'ping' });
}

import 'server-only';
import { env } from '@/config/env';
import { getGoogleAccessToken, hasGoogleServiceAccount } from './auth';
import { isAppsScriptConfigured, gasUpload, gasPing } from './appscript';

export function isDriveConfigured(): boolean {
  return isAppsScriptConfigured() || (hasGoogleServiceAccount() && Boolean(env.GOOGLE_DRIVE_FOLDER_ID));
}

const QUOTA_HELP =
  'Google rejected the upload because a service account has no Drive storage of its own. ' +
  'Use a Shared Drive (Google Workspace) and put the folder there, then share it with ' +
  `${env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? 'the service account'} as Content manager.`;

export interface DriveFile { id: string; webViewLink: string }

/** Upload a file into the configured Drive folder. Never throws — returns { error } instead. */
export async function uploadToDrive(name: string, mimeType: string, body: Buffer, folderPath: string[] = []): Promise<DriveFile | { error: string }> {
  // Preferred path: your own Apps Script web app (personal Drive, no Cloud Console, no billing).
  if (isAppsScriptConfigured()) {
    const r = await gasUpload(name, mimeType, body, folderPath);
    return 'error' in r ? r : { id: r.id, webViewLink: r.url };
  }
  if (!isDriveConfigured()) return { error: 'Google Drive is not connected. Set GAS_WEBAPP_URL + GAS_SECRET (easiest) in Vercel.' };
  const token = await getGoogleAccessToken();
  if (!token) return { error: 'Google authentication failed — check the service-account email and private key.' };

  const boundary = `ameya${Date.now()}`;
  const metadata = { name, parents: [env.GOOGLE_DRIVE_FOLDER_ID], mimeType };
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    body,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  try {
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: new Uint8Array(payload),
    });
    const text = await res.text();
    if (!res.ok) {
      if (/storageQuotaExceeded|storage quota/i.test(text)) return { error: QUOTA_HELP };
      if (/notFound|File not found/i.test(text)) return { error: `Drive folder not found — check GOOGLE_DRIVE_FOLDER_ID and share it with ${env.GOOGLE_SERVICE_ACCOUNT_EMAIL} as Editor.` };
      return { error: `Drive upload failed (${res.status}).` };
    }
    const j = JSON.parse(text) as { id?: string; webViewLink?: string };
    if (!j.id) return { error: 'Drive upload returned no file id.' };
    return { id: j.id, webViewLink: j.webViewLink ?? `https://drive.google.com/file/d/${j.id}/view` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Drive upload failed.' };
  }
}

/** Lightweight connectivity check used by the admin self-test. */
export async function checkDrive(): Promise<{ ok: true; folder: string } | { error: string }> {
  if (isAppsScriptConfigured()) {
    const p = await gasPing();
    return 'error' in p ? p : { ok: true, folder: p.folder };
  }
  if (!isDriveConfigured()) return { error: 'Google Drive is not connected. Set GAS_WEBAPP_URL + GAS_SECRET in Vercel (no Cloud Console needed).' };
  const token = await getGoogleAccessToken();
  if (!token) return { error: 'Google authentication failed — check the service-account email and private key.' };
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${env.GOOGLE_DRIVE_FOLDER_ID}?supportsAllDrives=true&fields=id,name,driveId`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { error: `Folder not accessible (${res.status}). Share it with ${env.GOOGLE_SERVICE_ACCOUNT_EMAIL} as Editor / Content manager.` };
    const j = (await res.json()) as { name?: string };
    return { ok: true, folder: j.name ?? 'folder' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Drive check failed.' };
  }
}

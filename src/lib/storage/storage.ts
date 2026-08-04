import 'server-only';
import { fetchWithTimeout } from '@/lib/utils/fetch-timeout';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/config/env';
import { safeSegment } from '@/lib/files/safety';

/**
 * Pluggable object storage:
 *  - `blob`  : Vercel Blob (zero-config on Vercel — recommended for serverless)
 *  - `s3`    : any S3-compatible backend (MinIO / AWS S3 / Cloudflare R2 / Supabase)
 *  - `local` : ./uploads-local (dev only; NOT for serverless — read-only FS)
 * The rest of the app depends only on this interface.
 */
export interface StoredObject { key: string; bucket: string; size: number }

const STORAGE_HELP =
  'File storage is not configured correctly. An admin needs to open Vercel → Storage, connect a Blob store to this project ' +
  '(which sets BLOB_READ_WRITE_TOKEN automatically), then redeploy.';

const LOCAL_DIR = path.join(process.cwd(), 'uploads-local');
const isBlobUrl = (key: string) => /^https?:\/\//.test(key);

let s3: S3Client | null = null;
function client(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      region: env.S3_REGION, endpoint: env.S3_ENDPOINT, forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } : undefined,
    });
  }
  return s3;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
  if (env.STORAGE_PROVIDER === 'blob') {
    if (!env.BLOB_READ_WRITE_TOKEN) throw new Error(STORAGE_HELP);
    try {
      const { put } = await import('@vercel/blob');
      /*
       * `access: 'public'` is the ONLY option this version of @vercel/blob has.
       *
       * That means every document, chat attachment and avatar on this provider
       * is world-readable to anyone holding the URL — and the folder-permission
       * checks in /api/files/[id] are bypassed entirely by anyone who obtains
       * one. The URL is stored in FileObject.key, returned in API responses, and
       * leaks through Referer.
       *
       * `addRandomSuffix: true` is the mitigation available here: it stops the
       * URL being derivable from folder id, timestamp and filename, so it is at
       * least genuinely unguessable rather than merely obscure. It is NOT a
       * substitute for authorisation.
       *
       * For title deeds, buyer agreements and ID documents, use
       * STORAGE_PROVIDER=s3 — that path already issues short-lived signed URLs
       * through `signedDownloadUrl` and honours the permission checks properly.
       * Admin → System health says which provider is in use and warns when it
       * is this one.
       */
      const res = await put(key, body, { access: 'public', contentType, token: env.BLOB_READ_WRITE_TOKEN, addRandomSuffix: true });
      return { key: res.url, bucket: 'blob', size: body.length }; // store the public URL as the key
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`${STORAGE_HELP} (storage said: ${detail})`);
    }
  }
  if (env.STORAGE_PROVIDER === 'local') {
    const full = path.join(LOCAL_DIR, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
    return { key, bucket: 'local', size: body.length };
  }
  await client().send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType }));
  return { key, bucket: env.S3_BUCKET, size: body.length };
}

export async function getObjectStream(key: string): Promise<{ body: Buffer }> {
  if (env.STORAGE_PROVIDER === 'blob' || isBlobUrl(key)) {
    const res = await fetchWithTimeout(key);
    return { body: Buffer.from(await res.arrayBuffer()) };
  }
  if (env.STORAGE_PROVIDER === 'local') return { body: await fs.readFile(path.join(LOCAL_DIR, key)) };
  const res = await client().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return { body: Buffer.from(bytes) };
}

/**
 * A URL that expires, where the provider supports one.
 *
 * S3 issues a genuine short-lived signature. Vercel Blob has no private mode in
 * this version, so the "signed" URL is just the public one — unguessable, but
 * permanent and unauthenticated. That difference is why `storageIsPrivate()`
 * exists and why System health surfaces it.
 */
export async function signedDownloadUrl(key: string, expiresIn = 300): Promise<string | null> {
  if (env.STORAGE_PROVIDER === 'blob' || isBlobUrl(key)) return key; // public + unguessable, NOT authorised
  if (env.STORAGE_PROVIDER === 'local') return null; // served via /api/files
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), { expiresIn });
}

export async function deleteObject(key: string): Promise<void> {
  if (env.STORAGE_PROVIDER === 'blob' || isBlobUrl(key)) {
    const { del } = await import('@vercel/blob');
    await del(key, { token: env.BLOB_READ_WRITE_TOKEN }).catch(() => undefined);
    return;
  }
  if (env.STORAGE_PROVIDER === 'local') { await fs.unlink(path.join(LOCAL_DIR, key)).catch(() => undefined); return; }
  await client().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

/**
 * Build a storage key for an uploaded document.
 *
 * BOTH segments are sanitised. The filename always was; `folderId` was not, and
 * it comes straight from a form field. On the local provider `putObject` does
 * `path.join(LOCAL_DIR, key)` followed by `mkdir -p` and `writeFile`, so a
 * folderId of `../../../src/app` was an arbitrary file write outside the upload
 * directory — remote code execution on a self-hosted deploy. The folder's
 * existence is also checked by the caller BEFORE the bytes are written; it used
 * to be validated only afterwards, by the foreign key on `document.create`.
 */
export function makeObjectKey(folderId: string, filename: string): string {
  return `documents/${safeSegment(folderId)}/${Date.now()}-${crypto.randomUUID()}-${safeSegment(filename, 'file')}`;
}

/**
 * Does the configured provider actually keep files private?
 *
 * True only for S3, where `signedDownloadUrl` issues a real expiring signature.
 * On Vercel Blob every object is world-readable at a permanent URL, so the
 * answer is no and the operator should know that before storing title deeds.
 */
export function storageIsPrivate(): boolean {
  return env.STORAGE_PROVIDER === 's3';
}

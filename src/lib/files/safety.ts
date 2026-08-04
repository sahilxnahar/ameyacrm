/**
 * One place that decides whether a file is safe to accept, and safe to show.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * The upload allow-list was enforced only in the browser. `universal-uploader`
 * checked `file.type` and showed a toast; the token the server minted carried no
 * `allowedContentTypes` at all on the chat (64 MB) and document (100 MB) paths.
 * So the "strict MIME allow-list" was a suggestion, and any signed-in person
 * could upload `.html` or `.svg` — both of which `lib/files/mime.ts` explicitly
 * knows how to name.
 *
 * That matters because of what happens at the other end. `/api/files/[id]`
 * served bytes back with `Content-Disposition: inline` and the uploader's own
 * `Content-Type`, from the app's own origin on the local provider. An uploaded
 * HTML file opened from a link was same-origin script execution.
 *
 * Two separate questions, deliberately separated:
 *
 *   `isAcceptableUpload` — may this be STORED at all? A narrow deny-list, so a
 *   DWG, an IFC, a RAR or next year's file format still work. Only the handful
 *   of types a browser will execute are refused.
 *
 *   `isInlineSafe` — may this be RENDERED in the page? A narrow allow-list, the
 *   opposite shape, because anything not positively known to be inert gets
 *   downloaded instead. A file that is safe to keep is not automatically safe
 *   to open.
 */

/**
 * Types a browser will execute in our origin. Refused at upload.
 *
 * SVG is on this list and that is deliberate: it is an image to a person and a
 * script container to a browser. `<svg><script>` runs. If SVG upload is ever
 * genuinely needed, sanitise it server-side first — do not relax this.
 */
const EXECUTABLE_TYPES = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'text/javascript',
  'application/javascript',
  'application/x-javascript',
  'application/xml',
  'text/xml',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-sh',
  'application/x-httpd-php',
]);

const EXECUTABLE_EXTENSIONS = new Set([
  'html', 'htm', 'xhtml', 'shtml', 'svg', 'js', 'mjs', 'cjs',
  'xml', 'xsl', 'xslt', 'php', 'phtml', 'jsp', 'asp', 'aspx',
  'exe', 'dll', 'bat', 'cmd', 'com', 'scr', 'msi', 'sh', 'bash',
  'htaccess', 'swf',
]);

/** Types that are safe to render in an iframe or an <img> without sanitising. */
const INLINE_SAFE_TYPES = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'image/bmp', 'image/tiff', 'image/heic', 'image/heif',
  'text/plain', 'text/csv', 'text/markdown',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
  'video/mp4', 'video/webm', 'video/quicktime',
]);

const extensionOf = (filename: string): string =>
  (filename.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * May this file be stored?
 *
 * Checks BOTH the declared type and the extension, because either one alone is
 * trivially bypassed: a browser will happily send `image/png` for a file named
 * `payload.html`, and `application/octet-stream` for one that is really HTML.
 */
export function isAcceptableUpload(
  contentType: string | null | undefined,
  filename: string | null | undefined,
): { ok: true } | { ok: false; reason: string } {
  const type = (contentType ?? '').split(';')[0]!.trim().toLowerCase();
  const ext = extensionOf(filename ?? '');

  if (type && EXECUTABLE_TYPES.has(type)) {
    return { ok: false, reason: `${type} files can run code in the browser, so they cannot be uploaded here.` };
  }
  if (ext && EXECUTABLE_EXTENSIONS.has(ext)) {
    return { ok: false, reason: `.${ext} files can run code in the browser, so they cannot be uploaded here.` };
  }
  return { ok: true };
}

/** Every content type the upload token will mint for, derived from the deny-list. */
export function allowedContentTypes(): string[] {
  // Vercel Blob wants an explicit list rather than a deny-list, so this is the
  // deny-list turned inside out: everything mime.ts knows about, minus the
  // executable ones, plus the wildcards that cover the long tail of drawing and
  // archive formats safely.
  return [
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp',
    'image/tiff', 'image/heic', 'image/heif', 'image/vnd.dwg', 'image/vnd.dxf',
    'text/plain', 'text/csv', 'text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip', 'application/vnd.rar', 'application/x-7z-compressed',
    'application/x-step', 'model/vnd.dwf',
    'application/octet-stream',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
    'video/mp4', 'video/webm', 'video/quicktime',
  ];
}

/**
 * May this file be rendered in the page, or must it be downloaded?
 *
 * An allow-list, not a deny-list. `application/octet-stream` is acceptable to
 * STORE — most CAD files arrive as it — but must never render inline, because
 * a browser asked to display an unknown type may sniff it and decide it is HTML.
 */
export function isInlineSafe(contentType: string | null | undefined, filename?: string | null): boolean {
  const type = (contentType ?? '').split(';')[0]!.trim().toLowerCase();
  if (!INLINE_SAFE_TYPES.has(type)) return false;
  // A .html named as text/plain is still a .html to anything that sniffs.
  const ext = extensionOf(filename ?? '');
  return !(ext && EXECUTABLE_EXTENSIONS.has(ext));
}

/**
 * Sanitise one path segment for an object key.
 *
 * `makeObjectKey` sanitised the filename and not the folder id, and the folder
 * was never checked to exist before the bytes were written. On the local
 * provider that is `path.join` + `mkdir -p` + `writeFile` with a caller-supplied
 * `../../../` — arbitrary file write, which on a self-hosted deploy is remote
 * code execution.
 */
export function safeSegment(value: string, fallback = 'unfiled'): string {
  const cleaned = (value ?? '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')   // no separators — nothing can traverse
    .replace(/\.{2,}/g, '_')             // no `..` run anywhere, not just at the start
    .replace(/^[._-]+/, '')              // no leading dot, so no hidden files either
    .slice(0, 128);
  return cleaned || fallback;
}

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isAcceptableUpload, isInlineSafe, allowedContentTypes, safeSegment } from '../src/lib/files/safety';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

/*
 * The upload surface, from the August 2026 audit.
 *
 * The allow-list was enforced only in the browser — `universal-uploader` showed
 * a toast, and the token the server minted carried no allowedContentTypes on the
 * chat or document paths. At the other end, /api/files/[id] served bytes back
 * with the uploader's own Content-Type and `inline`, from our own origin on the
 * local provider. Together that was: upload an .html, open its link, run script
 * as the victim.
 */
describe('what may be stored', () => {
  it('refuses the types a browser executes, however they are declared', () => {
    for (const [type, name] of [
      ['text/html', 'notes.html'],
      ['image/svg+xml', 'logo.svg'],
      ['application/javascript', 'x.js'],
      ['application/xhtml+xml', 'x.xhtml'],
    ] as const) {
      expect(isAcceptableUpload(type, name).ok, `${type} should be refused`).toBe(false);
    }
  });

  it('catches a mislabelled file by its extension', () => {
    // A browser will happily send image/png for a file called payload.html.
    expect(isAcceptableUpload('image/png', 'payload.html').ok).toBe(false);
    expect(isAcceptableUpload('application/octet-stream', 'shell.sh').ok).toBe(false);
    expect(isAcceptableUpload(null, 'x.svg').ok).toBe(false);
  });

  it('still accepts everything a real user uploads', () => {
    for (const [type, name] of [
      ['application/pdf', 'agreement.pdf'],
      ['image/jpeg', 'site.jpg'],
      ['image/vnd.dwg', 'plan.dwg'],
      ['application/octet-stream', 'model.rvt'],
      ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'boq.xlsx'],
      ['application/zip', 'drawings.zip'],
      ['video/mp4', 'progress.mp4'],
    ] as const) {
      expect(isAcceptableUpload(type, name).ok, `${name} should be accepted`).toBe(true);
    }
  });

  it('gives a reason a person can act on', () => {
    const r = isAcceptableUpload('text/html', 'x.html');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/run code in the browser/);
  });
});

describe('what may be rendered', () => {
  it('is an allow-list, so an unknown type downloads rather than renders', () => {
    // application/octet-stream is fine to STORE — most CAD files arrive as it —
    // and must never render, because a browser asked to display an unknown type
    // may sniff it and decide it is HTML.
    expect(isInlineSafe('application/octet-stream', 'model.rvt')).toBe(false);
    expect(isInlineSafe('application/zip', 'a.zip')).toBe(false);
    expect(isInlineSafe(null, 'a.pdf')).toBe(false);
  });

  it('renders the things worth rendering', () => {
    expect(isInlineSafe('application/pdf', 'agreement.pdf')).toBe(true);
    expect(isInlineSafe('image/png', 'plan.png')).toBe(true);
    expect(isInlineSafe('text/plain', 'notes.txt')).toBe(true);
  });

  it('will not render a .html dressed as text/plain', () => {
    expect(isInlineSafe('text/plain', 'payload.html')).toBe(false);
  });
});

describe('object keys cannot escape their directory', () => {
  it('neutralises traversal', () => {
    /*
     * On the local provider this is path.join + mkdir -p + writeFile, so a
     * folderId of ../../../src/app was arbitrary file write — RCE on self-host.
     *
     * The property that matters is: no path separator, no `..` run, and no
     * leading dot. Anything satisfying those three cannot leave its directory,
     * whatever else it contains.
     */
    for (const evil of ['../../../src/app', '..', '....//....//etc', 'a/../b', '..\\..\\windows', '.hidden']) {
      const out = safeSegment(evil);
      expect(out, `${evil} → ${out}`).not.toMatch(/[\\/]/);
      expect(out, `${evil} → ${out}`).not.toContain('..');
      expect(out, `${evil} → ${out}`).not.toMatch(/^\./);
    }
    expect(safeSegment('..')).toBe('unfiled');
  });

  it('leaves a normal id alone', () => {
    expect(safeSegment('clh7x2k9a0001abcd')).toBe('clh7x2k9a0001abcd');
  });

  it('is applied to both segments of the key', () => {
    const src = read('src/lib/storage/storage.ts');
    expect(src).toMatch(/safeSegment\(folderId\)/);
    expect(src).toMatch(/safeSegment\(filename/);
  });
});

describe('the fixes are wired where they matter', () => {
  it('the upload token carries the allow-list on every branch', () => {
    const src = read('src/app/api/upload/route.ts');
    // avatar has its own narrower list; chat and documents use the shared one.
    expect((src.match(/allowedContentTypes/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(allowedContentTypes()).not.toContain('text/html');
    expect(allowedContentTypes()).not.toContain('image/svg+xml');
  });

  it('the file route sends nosniff and decides inline by type', () => {
    const src = read('src/app/api/files/[id]/route.ts');
    expect(src).toContain('X-Content-Type-Options');
    expect(src).toContain('isInlineSafe');
    expect(src).toContain('Content-Security-Policy');
  });

  it('document processing is owner-gated, not merely signed-in', () => {
    const src = read('src/app/api/documents/process/route.ts');
    expect(src).toMatch(/uploadedById !== ctx\.user\.id/);
  });

  it('the folder is checked before the bytes are written', () => {
    const src = read('src/server/actions/documents.ts');
    const folderCheck = src.indexOf('folder.findUnique');
    const write = src.indexOf('await putObject');
    expect(folderCheck).toBeGreaterThan(-1);
    expect(folderCheck, 'the existence check must precede the write').toBeLessThan(write);
  });

  it('says out loud that Vercel Blob is not private', () => {
    // The honest half of AMH-018: this package version has no private mode, so
    // the fix is an unguessable key plus telling the operator the truth.
    expect(read('src/lib/storage/storage.ts')).toContain('addRandomSuffix: true');
    expect(read('src/server/services/integrations-service.ts')).toMatch(/readable by anyone with the link/);
  });
});

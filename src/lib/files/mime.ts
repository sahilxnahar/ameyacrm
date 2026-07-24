/** File type detection, shared by the browser and the server. */

export const BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  gif: 'image/gif', heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp', tiff: 'image/tiff',
  txt: 'text/plain', csv: 'text/csv', md: 'text/markdown', html: 'text/html',
  // Office and drawing formats. Gemini cannot read these directly, but naming
  // them means the CRM stores and mirrors them properly and can say why the AI
  // skipped one instead of failing with an empty reason.
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  svg: 'image/svg+xml',
  dwg: 'image/vnd.dwg', dxf: 'image/vnd.dxf', dwf: 'model/vnd.dwf',
  rvt: 'application/octet-stream', skp: 'application/octet-stream',
  ifc: 'application/x-step', step: 'application/x-step', stp: 'application/x-step',
  zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
  dwgx: 'image/vnd.dwg',
};

/**
 * Work out a file's type from its name when the browser will not say.
 *
 * Files dragged from design tools, and anything with an unusual extension like
 * .dwg or .ifc, arrive with an empty type or application/octet-stream. Storing
 * that as-is meant the CRM could not tell a drawing from a spreadsheet.
 */
export function inferMimeType(reported: string, filename: string): string {
  const r = (reported || '').toLowerCase();
  if (r && r !== 'application/octet-stream' && r !== 'binary/octet-stream') return r;
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  return BY_EXTENSION[ext] ?? r ?? 'application/octet-stream';
}

/** A short human label for a file, used in listings. */
export function fileKindLabel(mimeType: string, filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  if (['dwg', 'dxf', 'dwf', 'rvt', 'skp', 'ifc', 'step', 'stp'].includes(ext)) return 'Drawing';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('image/')) return 'Image';
  if (/spreadsheet|ms-excel|csv/.test(mimeType)) return 'Spreadsheet';
  if (/wordprocessing|msword/.test(mimeType)) return 'Document';
  if (/presentation|powerpoint/.test(mimeType)) return 'Presentation';
  if (/zip|rar|7z/.test(mimeType)) return 'Archive';
  if (mimeType.startsWith('text/')) return 'Text';
  return 'File';
}

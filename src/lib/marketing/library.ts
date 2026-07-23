// Client-safe Marketing Library helpers (no server-only imports).

export const MARKETING_CATEGORIES = [
  'Renders & Images', 'Floor Plans', 'Brochures & Flyers', 'Legal & Compliance',
  'Financial', 'Comparisons & Research', 'Presentations', 'Other',
] as const;
export type MarketingCategory = (typeof MARKETING_CATEGORIES)[number];

export interface LibraryItem {
  id: string; title: string; category: string; kind: string; url: string;
  source: string; fileType: string | null; sizeBytes: number | null; folderPath: string | null; createdAt: string;
}

/** Coarse file kind from the name/mime, for the icon and viewer choice. */
export function kindFromType(name: string, type: string): string {
  const n = name.toLowerCase();
  if (type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|svg)$/.test(n)) return 'image';
  if (type === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (/\.(xlsx?|csv)$/.test(n)) return 'excel';
  if (/\.(docx?|txt|rtf|pptx?)$/.test(n)) return 'doc';
  return 'other';
}

/** A quick keyword/extension guess, used as the fallback when AI isn't available. */
export function heuristicCategory(name: string, type: string): string {
  const n = name.toLowerCase();
  if (/floor\s*plan|floorplan|layout|master\s*plan/.test(n)) return 'Floor Plans';
  if (type.startsWith('image/') || /render|elevation|3d|facade|\bview\b|photo/.test(n)) return 'Renders & Images';
  if (/brochure|flyer|leaflet|teaser|creative|poster|banner/.test(n)) return 'Brochures & Flyers';
  if (/agreement|legal|khata|rera|title|deed|\bnoc\b|approval|sanction|encumbrance|litigation/.test(n)) return 'Legal & Compliance';
  if (/audit|financ|cost|price|budget|revenue|pnl|p&l|invoice|\bgst\b|balance\s*sheet/.test(n)) return 'Financial';
  if (/compar|\bvs\b|benchmark|research|market\s*study/.test(n)) return 'Comparisons & Research';
  if (/\.pptx?$|deck|presentation|pitch/.test(n)) return 'Presentations';
  if (/\.(xlsx?|csv)$/.test(n)) return 'Financial';
  return 'Other';
}

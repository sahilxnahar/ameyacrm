/**
 * Marketing collaterals bundled into the app so the team can always view them
 * without hunting through folders. Files live under /public/marketing (served at
 * /marketing/...). Add or swap entries here as new material is produced.
 */
export type CollateralKind = 'image' | 'pdf' | 'excel' | 'html' | 'brand';

export interface Collateral {
  title: string;
  description: string;
  file: string; // public path
  kind: CollateralKind;
}

export const MARKETING_COLLATERALS: Collateral[] = [
  { title: 'Basaveshwar Nagar — Front Elevation', description: 'Hero render of the residential front elevation.', file: '/marketing/basaveshwar-front.jpg', kind: 'image' },
  { title: 'Basaveshwar Nagar — Commercial Block', description: 'Commercial block render (Option VI).', file: '/marketing/basaveshwar-commercial.jpg', kind: 'image' },
  { title: '3D Building Model', description: 'Interactive 3D massing model — opens in a new tab.', file: '/marketing/basaveshwar-3d-model.html', kind: 'html' },
  { title: 'Ameya vs National Developers', description: 'Positioning comparison worksheet.', file: '/marketing/ameya-vs-national-developers.xlsx', kind: 'excel' },
  { title: 'Roadmap Tracker', description: 'Project roadmap and milestone tracker.', file: '/marketing/ameya-roadmap-tracker.xlsx', kind: 'excel' },
  { title: 'Website Audit Report', description: 'Latest public-site audit (PDF).', file: '/marketing/ameyaheights-audit.pdf', kind: 'pdf' },
  { title: 'Ameya Emblem (brand mark)', description: 'The official Ameya Heights emblem, high-resolution PNG.', file: '/brand/ameya-emblem.png', kind: 'brand' },
];

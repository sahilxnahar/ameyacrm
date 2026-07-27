/**
 * Pan-India due-diligence authority directory. Each entry is an official
 * state/local government portal a liaison team uses to fetch a record (RERA,
 * encumbrance, RoR/land record, town-planning sanction, etc.). Grouped by state,
 * then by the authority. URLs are the public portals; the app opens them in a new
 * tab (click-out) and offers a dropzone to file the downloaded PDF into the vault.
 */
export interface Authority {
  name: string;
  url: string;
  kind: string;   // short tag: RERA | Land | Registration | Planning | Municipal | Hill
  region?: string;
  note?: string;
  keywords?: string; // extra search terms (cities the portal covers, aliases)
}
export interface StateDirectory { state: string; blurb: string; authorities: Authority[] }

export const DD_DIRECTORY: StateDirectory[] = [
  {
    state: 'Tamil Nadu',
    blurb: 'Chennai · ECR · Kodaikanal',
    authorities: [
      { name: 'TNRERA', url: 'https://rera.tn.gov.in/', kind: 'RERA', note: 'Project & agent registration' },
      { name: 'Patta Chitta (e-Services)', url: 'https://eservices.tn.gov.in/eservicesnew/index.html', kind: 'Land', note: 'Patta / Chitta / A-Register' },
      { name: 'TNREGINET', url: 'https://tnreginet.gov.in/', kind: 'Registration', note: 'EC & registration' },
      { name: 'CMDA', url: 'https://www.cmdachennai.gov.in/', kind: 'Planning', region: 'Chennai', note: 'Chennai Metropolitan Development Authority' },
      { name: 'DTCP Tamil Nadu', url: 'https://www.dtcp.tn.gov.in/', kind: 'Planning', note: 'Directorate of Town & Country Planning' },
      { name: 'HACA (Hill Area)', url: 'https://kodaikanal.nic.in/', kind: 'Hill', region: 'Kodaikanal', note: 'Hill Area Conservation Authority clearances' },
    ],
  },
  {
    state: 'Madhya Pradesh',
    blurb: 'Indore · Bhopal',
    authorities: [
      { name: 'MP RERA', url: 'https://rera.mp.gov.in/', kind: 'RERA', keywords: 'Indore Bhopal' },
      { name: 'MP Bhulekh (WebGIS 2.0)', url: 'https://mpbhulekh.gov.in/', kind: 'Land', note: 'Khasra / Khatauni / map', keywords: 'Indore Bhopal' },
      { name: 'MP IGRS — Sampada', url: 'https://www.mpigr.gov.in/', kind: 'Registration', note: 'Registration & EC (Sampada)', keywords: 'Indore Bhopal' },
      { name: 'IDA', url: 'https://www.idaindore.org/', kind: 'Planning', region: 'Indore', note: 'Indore Development Authority' },
    ],
  },
  {
    state: 'Rajasthan',
    blurb: 'Jaipur & statewide',
    authorities: [
      { name: 'RajRERA', url: 'https://rera.rajasthan.gov.in/', kind: 'RERA' },
      { name: 'Apna Khata / E-Dharti', url: 'https://apnakhata.rajasthan.gov.in/', kind: 'Land', note: 'Jamabandi (RoR) records' },
      { name: 'IGRS Rajasthan (E-Panjiyan)', url: 'https://epanjiyan.rajasthan.gov.in/', kind: 'Registration', note: 'Registration & EC' },
    ],
  },
  {
    state: 'Maharashtra',
    blurb: 'Pune · Mumbai',
    authorities: [
      { name: 'MahaRERA', url: 'https://maharera.maharashtra.gov.in/', kind: 'RERA' },
      { name: 'Mahabhulekh (7/12 & 8A)', url: 'https://bhulekh.mahabhumi.gov.in/', kind: 'Land', note: '7/12 extract & 8A' },
      { name: 'IGR Maharashtra', url: 'https://igrmaharashtra.gov.in/', kind: 'Registration', note: 'Registration & EC' },
      { name: 'PMRDA', url: 'https://pmrda.gov.in/', kind: 'Planning', region: 'Pune', note: 'Pune Metropolitan Region Development Authority' },
      { name: 'PMC', url: 'https://www.pmc.gov.in/', kind: 'Municipal', region: 'Pune', note: 'Pune Municipal Corporation' },
      { name: 'PCMC', url: 'https://www.pcmcindia.gov.in/', kind: 'Municipal', region: 'Pimpri-Chinchwad' },
    ],
  },
  {
    state: 'Karnataka',
    blurb: 'Bengaluru',
    authorities: [
      { name: 'K-RERA', url: 'https://rera.karnataka.gov.in/', kind: 'RERA' },
      { name: 'Bhoomi (RTC)', url: 'https://landrecords.karnataka.gov.in/', kind: 'Land', note: 'RTC / pahani, mutation' },
      { name: 'Kaveri Online', url: 'https://kaverionline.karnataka.gov.in/', kind: 'Registration', note: 'Registration & EC' },
      { name: 'BDA', url: 'https://bdabangalore.org/', kind: 'Planning', region: 'Bengaluru', note: 'Bangalore Development Authority' },
      { name: 'BBMP', url: 'https://bbmp.gov.in/', kind: 'Municipal', region: 'Bengaluru', note: 'Khata / PID / property tax' },
      { name: 'BMRDA', url: 'https://bmrda.karnataka.gov.in/', kind: 'Planning', note: 'Bangalore Metropolitan Region Development Authority' },
    ],
  },
  {
    state: 'Delhi / NCR',
    blurb: 'Delhi',
    authorities: [
      { name: 'Delhi RERA', url: 'https://rera.delhi.gov.in/', kind: 'RERA' },
      { name: 'Delhi Bhulekh (DLRC)', url: 'https://dlrc.delhi.gov.in/', kind: 'Land', note: 'Land records / RoR' },
      { name: 'DDA', url: 'https://dda.gov.in/', kind: 'Planning', note: 'Delhi Development Authority' },
    ],
  },
];

/** Flat, searchable list for the ⌘K / filter box: "CMDA", "Kodaikanal HACA", "Indore Bhulekh". */
export interface FlatAuthority extends Authority { state: string }
export const DD_AUTHORITIES_FLAT: FlatAuthority[] = DD_DIRECTORY.flatMap((s) =>
  s.authorities.map((a) => ({ ...a, state: s.state })),
);

/** True if every whitespace-separated token in the query appears somewhere in the
 * authority's searchable text — so "Kodaikanal HACA" and "Indore Bhulekh" both hit. */
export function authorityMatches(a: FlatAuthority | (Authority & { state?: string }), query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const hay = [a.name, (a as FlatAuthority).state, a.region, a.kind, a.note, a.keywords].filter(Boolean).join(' ').toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

export function searchAuthorities(q: string): FlatAuthority[] {
  if (!q.trim()) return DD_AUTHORITIES_FLAT;
  return DD_AUTHORITIES_FLAT.filter((a) => authorityMatches(a, q));
}

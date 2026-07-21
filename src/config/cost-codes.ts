/**
 * The standard cost breakdown for a residential development.
 *
 * Deliberately shallow — three levels at most. A twelve-level cost structure
 * is admired at set-up and abandoned within a quarter, because somebody has to
 * choose the right code on every single bill. These are heads that a site
 * engineer can pick correctly without a manual.
 *
 * `accountCode` ties each head to the ledger, so budget-versus-actual can read
 * real postings instead of anybody maintaining a mapping spreadsheet.
 */
export interface SeedCostCode {
  code: string;
  name: string;
  parent?: string;
  isGroup?: boolean;
  accountCode?: string;
}

export const COST_CODES: SeedCostCode[] = [
  { code: 'L', name: 'Land', isGroup: true },
  { code: 'L-10', name: 'Land cost', parent: 'L', isGroup: false, accountCode: '5100' },
  { code: 'L-20', name: 'Stamp duty and registration', parent: 'L', isGroup: false, accountCode: '5230' },
  { code: 'L-30', name: 'Legal and title', parent: 'L', isGroup: false, accountCode: '5540' },

  { code: 'A', name: 'Approvals and statutory', isGroup: true },
  { code: 'A-10', name: 'BBMP and BDA', parent: 'A', isGroup: false, accountCode: '5210' },
  { code: 'A-20', name: 'BESCOM and BWSSB', parent: 'A', isGroup: false, accountCode: '5220' },
  { code: 'A-30', name: 'RERA and other registration', parent: 'A', isGroup: false, accountCode: '5230' },
  { code: 'A-40', name: 'Panchayat, DTCP and local bodies', parent: 'A', isGroup: false, accountCode: '5240' },
  { code: 'A-50', name: 'Liaison and consultants', parent: 'A', isGroup: false, accountCode: '5540' },

  { code: 'D', name: 'Design and consultancy', isGroup: true },
  { code: 'D-10', name: 'Architect', parent: 'D', isGroup: false, accountCode: '5510' },
  { code: 'D-20', name: 'Structural', parent: 'D', isGroup: false, accountCode: '5520' },
  { code: 'D-30', name: 'MEP', parent: 'D', isGroup: false, accountCode: '5530' },
  { code: 'D-40', name: 'Other consultants', parent: 'D', isGroup: false, accountCode: '5500' },

  { code: 'S', name: 'Structure', isGroup: true },
  { code: 'S-10', name: 'Excavation and earthwork', parent: 'S', isGroup: false, accountCode: '5410' },
  { code: 'S-20', name: 'Foundation', parent: 'S', isGroup: false, accountCode: '5410' },
  { code: 'S-30', name: 'Concrete and RMC', parent: 'S', isGroup: false, accountCode: '5310' },
  { code: 'S-40', name: 'Steel', parent: 'S', isGroup: false, accountCode: '5320' },
  { code: 'S-50', name: 'Formwork and shuttering', parent: 'S', isGroup: false, accountCode: '5410' },
  { code: 'S-60', name: 'Blockwork and masonry', parent: 'S', isGroup: false, accountCode: '5340' },

  { code: 'F', name: 'Finishes', isGroup: true },
  { code: 'F-10', name: 'Plastering', parent: 'F', isGroup: false, accountCode: '5440' },
  { code: 'F-20', name: 'Flooring and tiling', parent: 'F', isGroup: false, accountCode: '5350' },
  { code: 'F-30', name: 'Painting', parent: 'F', isGroup: false, accountCode: '5440' },
  { code: 'F-40', name: 'Doors and windows', parent: 'F', isGroup: false, accountCode: '5350' },
  { code: 'F-50', name: 'Waterproofing', parent: 'F', isGroup: false, accountCode: '5440' },
  { code: 'F-60', name: 'Kitchen and joinery', parent: 'F', isGroup: false, accountCode: '5350' },

  { code: 'M', name: 'Services (MEP)', isGroup: true },
  { code: 'M-10', name: 'Electrical', parent: 'M', isGroup: false, accountCode: '5420' },
  { code: 'M-20', name: 'Plumbing and sanitary', parent: 'M', isGroup: false, accountCode: '5430' },
  { code: 'M-30', name: 'Fire fighting', parent: 'M', isGroup: false, accountCode: '5420' },
  { code: 'M-40', name: 'Lifts', parent: 'M', isGroup: false, accountCode: '5420' },
  { code: 'M-50', name: 'STP, WTP and pumps', parent: 'M', isGroup: false, accountCode: '5430' },
  { code: 'M-60', name: 'DG set and transformer', parent: 'M', isGroup: false, accountCode: '5420' },

  { code: 'E', name: 'External and amenities', isGroup: true },
  { code: 'E-10', name: 'Compound wall and gates', parent: 'E', isGroup: false, accountCode: '5410' },
  { code: 'E-20', name: 'Roads and paving', parent: 'E', isGroup: false, accountCode: '5410' },
  { code: 'E-30', name: 'Landscaping', parent: 'E', isGroup: false, accountCode: '5440' },
  { code: 'E-40', name: 'Clubhouse and amenities', parent: 'E', isGroup: false, accountCode: '5440' },

  { code: 'P', name: 'Preliminaries and site', isGroup: true },
  { code: 'P-10', name: 'Site establishment', parent: 'P', isGroup: false, accountCode: '5600' },
  { code: 'P-20', name: 'Plant hire', parent: 'P', isGroup: false, accountCode: '5600' },
  { code: 'P-30', name: 'Site labour', parent: 'P', isGroup: false, accountCode: '5450' },
  { code: 'P-40', name: 'Power, water and temporary works', parent: 'P', isGroup: false, accountCode: '5600' },

  { code: 'O', name: 'Overheads and selling', isGroup: true },
  { code: 'O-10', name: 'Marketing and advertising', parent: 'O', isGroup: false, accountCode: '6200' },
  { code: 'O-20', name: 'Brokerage and commission', parent: 'O', isGroup: false, accountCode: '6300' },
  { code: 'O-30', name: 'Salaries', parent: 'O', isGroup: false, accountCode: '6100' },
  { code: 'O-40', name: 'Finance cost and interest', parent: 'O', isGroup: false, accountCode: '6700' },
  { code: 'O-50', name: 'Administration', parent: 'O', isGroup: false, accountCode: '6900' },

  { code: 'C', name: 'Contingency', isGroup: true },
  { code: 'C-10', name: 'Contingency', parent: 'C', isGroup: false, accountCode: '6900' },
];

/**
 * How far a head may move before somebody has to write down why.
 *
 * Both a percentage and an absolute floor: five per cent of a ₹40,000 head is
 * ₹2,000 and explaining that wastes everyone's time, while five per cent of a
 * ₹4 crore head is ₹20 lakh and very much wants an explanation.
 */
export const VARIANCE_THRESHOLD_PCT = 5;
export const VARIANCE_THRESHOLD_ABS = 100000;

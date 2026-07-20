/** Entities that can carry admin-defined fields. */
export const CUSTOM_FIELD_ENTITIES = [
  { key: 'lead', label: 'Leads', hint: 'Shown on every enquiry' },
  { key: 'unit', label: 'Units', hint: 'Shown on every flat in the inventory' },
  { key: 'booking', label: 'Bookings', hint: 'Shown on every sale' },
  { key: 'customer', label: 'Buyers', hint: 'Shown on every buyer record' },
] as const;

export type CustomFieldEntity = (typeof CUSTOM_FIELD_ENTITIES)[number]['key'];

/**
 * Words the CRM uses that a company may want to say differently.
 * Stored under the `terms` setting and applied wherever these appear.
 */
export interface Terminology {
  lead: string;
  leads: string;
  unit: string;
  units: string;
  booking: string;
  bookings: string;
  customer: string;
  customers: string;
  project: string;
  projects: string;
}

export const DEFAULT_TERMS: Terminology = {
  lead: 'Lead', leads: 'Leads',
  unit: 'Unit', units: 'Units',
  booking: 'Booking', bookings: 'Bookings',
  customer: 'Buyer', customers: 'Buyers',
  project: 'Project', projects: 'Projects',
};

/** The stages a lead moves through. Labels are yours; the underlying keys are fixed. */
export const PIPELINE_KEYS = ['NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'WON', 'LOST'] as const;
export type PipelineKey = (typeof PIPELINE_KEYS)[number];

export interface StageConfig {
  label: string;
  probability: number;   // % chance of closing, drives the forecast
  active: boolean;       // show it on the board
}

export const DEFAULT_STAGES: Record<PipelineKey, StageConfig> = {
  NEW:         { label: 'New',            probability: 5,   active: true },
  CONTACTED:   { label: 'Contacted',      probability: 10,  active: true },
  QUALIFIED:   { label: 'Qualified',      probability: 25,  active: true },
  SITE_VISIT:  { label: 'Site visit done', probability: 45, active: true },
  NEGOTIATION: { label: 'Negotiating',    probability: 70,  active: true },
  BOOKED:      { label: 'Booked',         probability: 90,  active: true },
  WON:         { label: 'Won',            probability: 100, active: true },
  LOST:        { label: 'Lost',           probability: 0,   active: true },
};

/**
 * Short, plain-language orientation for the screens a non-specialist is most
 * likely to land on and feel lost. The `ScreenHelp` component renders these as a
 * collapsible "How this works" note under the page title. Keep it to a couple of
 * sentences and the first thing to do — this is a nudge, not a manual.
 */
export interface ScreenHelp {
  title?: string;
  points: string[];
  firstAction?: string;
}

export const SCREEN_HELP: Record<string, ScreenHelp> = {
  procurement: {
    points: [
      'This is where you confirm what actually arrived on site and check it against the order and the bill — the "three-way match".',
      'When the three do not agree, the screen shows how, so you never pay for material that did not turn up.',
    ],
    firstAction: 'Record a goods receipt for a recent delivery.',
  },
  capital: {
    points: [
      'This tracks the money behind the project: investors, the capital stack, and the RERA escrow account.',
      'By law, 70% of what buyers pay must sit in escrow and only fund construction — this is where that is watched, along with loan covenants.',
    ],
    firstAction: 'Open the escrow tab to see the current balance and movements.',
  },
  programme: {
    points: [
      'This is the construction schedule: activities, how they depend on each other, and how far each has progressed.',
      '"Earned value" tells you whether you are ahead or behind by comparing work actually done against what was planned.',
    ],
    firstAction: 'Update progress on an active activity.',
  },
  quality: {
    points: [
      'Inspections, non-conformances (things built wrong that must be fixed), safety records and work permits live here.',
      'A "hold point" is a stage where work must stop for a check before it can continue.',
    ],
    firstAction: 'Log an inspection or raise a non-conformance.',
  },
  land: {
    points: [
      'This holds the land itself: parcels, the title chain that proves ownership, government approvals, and any litigation.',
      'A clean, unbroken title chain is what proves the seller really owns the land you are building on.',
    ],
    firstAction: 'Open a parcel to see its title documents and approvals.',
  },
  treasury: {
    points: [
      'Your bank position across accounts, matching records to statements (reconciliation), and a short cash-flow forecast.',
      'Reconciliation makes sure every rupee in your books matches the bank — so nothing is missed or double-counted.',
    ],
    firstAction: 'Import a bank statement to reconcile.',
  },
  feasibility: {
    points: [
      'Before committing to a project, model whether it will actually make money.',
      'Change the assumptions (price, cost, timeline) and see the effect on the return.',
    ],
    firstAction: 'Create a new appraisal or open an existing one.',
  },
  'report-builder': {
    points: [
      'Build your own report: pick a source, a field to group by, and a measure (count, sum or average).',
      'Save it — privately or shared — to run again later. Only allowed sources and fields are offered.',
    ],
    firstAction: 'Pick a source and press Run report.',
  },
};

export function screenHelp(id: string): ScreenHelp | undefined {
  return SCREEN_HELP[id];
}

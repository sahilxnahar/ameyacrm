/**
 * Snagging SLA and routing — pure functions, no imports, so they run on the
 * server, in the buyer portal, and in tests alike.
 *
 * A defect at handover is classified by type; the type sets both how long we
 * have to fix it (the SLA clock) and who it goes to. Structural and services
 * issues route to the certifying engineer; finishing/cosmetic issues to the
 * site supervisor.
 */
export type SnagKind = 'structural' | 'plumbing' | 'electrical' | 'cosmetic' | 'other';

const SLA_HOURS: Record<SnagKind, number> = {
  structural: 72,
  plumbing: 48,
  electrical: 48,
  cosmetic: 96,
  other: 72,
};

const KIND_LABEL: Record<SnagKind, string> = {
  structural: 'Structural',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  cosmetic: 'Finishing / cosmetic',
  other: 'Other',
};

export function snagKindLabel(kind: SnagKind): string {
  return KIND_LABEL[kind];
}

/** Work out the type from the chosen category, falling back to keywords. */
export function classifySnag(category?: string | null, text?: string): SnagKind {
  const known = (category ?? '').trim().toLowerCase();
  if (['structural', 'plumbing', 'electrical', 'cosmetic', 'other'].includes(known)) return known as SnagKind;
  const s = `${category ?? ''} ${text ?? ''}`.toLowerCase();
  if (/structural|crack|beam|column|slab|foundation|seepage|waterproof|leak(age)?/.test(s)) return 'structural';
  if (/plumb|pipe|tap|drain|sanitary|toilet|faucet|flush|water\b/.test(s)) return 'plumbing';
  if (/electric|wiring|socket|switch|mcb|\blight\b|power|fan\b/.test(s)) return 'electrical';
  if (/paint|scratch|tile|polish|finish|cosmetic|door|window|cabinet|dent|chip|stain/.test(s)) return 'cosmetic';
  return 'other';
}

export interface SnagSla {
  kind: SnagKind;
  dueAt: Date;
  hours: number;
  overdue: boolean;
  resolvedInSla?: boolean;
  label: string;
}

/** The SLA position for a ticket. Pass `now` for testability. */
export function snagSla(kind: SnagKind, createdAt: Date, resolvedAt?: Date | null, now: Date = new Date()): SnagSla {
  const hours = SLA_HOURS[kind];
  const dueAt = new Date(createdAt.getTime() + hours * 36e5);
  if (resolvedAt) {
    const inSla = resolvedAt <= dueAt;
    return { kind, dueAt, hours, overdue: false, resolvedInSla: inSla, label: inSla ? 'Resolved within SLA' : 'Resolved (late)' };
  }
  const overdue = now > dueAt;
  const hrs = Math.round((dueAt.getTime() - now.getTime()) / 36e5);
  return { kind, dueAt, hours, overdue, label: overdue ? `SLA overdue by ${Math.abs(hrs)}h` : `Due in ${hrs}h` };
}

/** Which Setting key holds the user this kind routes to. */
export function snagRouteKey(kind: SnagKind): 'snag.route.structural' | 'snag.route.cosmetic' {
  return kind === 'structural' || kind === 'plumbing' || kind === 'electrical' ? 'snag.route.structural' : 'snag.route.cosmetic';
}

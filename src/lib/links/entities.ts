/**
 * The record types that can be linked to one another, and where each one lives.
 * Kept pure so the "what can link to what" and "where does it open" rules are one
 * testable place, shared by the service, the actions and the UI.
 */
export const LINKABLE_TYPES = ['Lead', 'Booking', 'Task', 'WorkRequest', 'Voucher', 'Document', 'Unit', 'LandParcel'] as const;
export type LinkableType = (typeof LINKABLE_TYPES)[number];

export function isLinkable(type: string): type is LinkableType {
  return (LINKABLE_TYPES as readonly string[]).includes(type);
}

/** Where a record opens. Types without their own detail page point at their list. */
export function entityHref(type: string, id: string): string | null {
  switch (type) {
    case 'Lead': return `/sales/${id}`;
    case 'Task': return `/tasks/${id}`;
    case 'WorkRequest': return `/work-requests/${id}`;
    case 'Voucher': return '/payments';
    case 'Booking': return '/customers';
    case 'Document': return '/documents';
    case 'Unit': return '/inventory';
    case 'LandParcel': return '/land';
    default: return null;
  }
}

/** A human word for a type, for labels and tooltips. */
export function entityTypeLabel(type: string): string {
  switch (type) {
    case 'WorkRequest': return 'Work request';
    case 'LandParcel': return 'Land parcel';
    default: return type;
  }
}

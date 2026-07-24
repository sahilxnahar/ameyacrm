/**
 * The lifecycle of an inter-department work request, kept pure so the allowed
 * moves are one testable place — not scattered across buttons and actions.
 *
 * A request is raised by one department to another. The *receiving* side accepts
 * it, works it and marks it done; the *raising* side confirms it is actually
 * done (or sends it back). Either side can end it early: the raiser can cancel,
 * the receiver can reject.
 */
export type WRStatus =
  | 'RAISED' | 'ACCEPTED' | 'IN_PROGRESS' | 'DONE' | 'CONFIRMED' | 'REJECTED' | 'SENT_BACK';

export type WRSide = 'raiser' | 'receiver';

export const WR_TERMINAL: WRStatus[] = ['CONFIRMED', 'REJECTED'];

export function isTerminal(status: WRStatus): boolean {
  return WR_TERMINAL.includes(status);
}

/**
 * The statuses `side` may move a request to from its current `status`.
 * An empty list means that side has no move right now.
 */
export function nextStatuses(status: WRStatus, side: WRSide): WRStatus[] {
  if (side === 'receiver') {
    switch (status) {
      case 'RAISED': return ['ACCEPTED', 'REJECTED'];
      case 'ACCEPTED': return ['IN_PROGRESS', 'REJECTED'];
      case 'IN_PROGRESS': return ['DONE'];
      case 'SENT_BACK': return ['IN_PROGRESS', 'REJECTED'];
      default: return [];
    }
  }
  // raiser
  switch (status) {
    case 'RAISED': return ['REJECTED']; // cancel their own request
    case 'DONE': return ['CONFIRMED', 'SENT_BACK'];
    default: return [];
  }
}

export function canTransition(status: WRStatus, side: WRSide, to: WRStatus): boolean {
  return nextStatuses(status, side).includes(to);
}

const LABELS: Record<WRStatus, string> = {
  RAISED: 'Raised', ACCEPTED: 'Accepted', IN_PROGRESS: 'In progress',
  DONE: 'Done', CONFIRMED: 'Confirmed', REJECTED: 'Rejected', SENT_BACK: 'Sent back',
};
export function wrStatusLabel(status: string): string {
  return LABELS[status as WRStatus] ?? status;
}

/** A friendly verb for the button that moves to a status. */
export function wrActionLabel(to: WRStatus): string {
  switch (to) {
    case 'ACCEPTED': return 'Accept';
    case 'IN_PROGRESS': return 'Start work';
    case 'DONE': return 'Mark done';
    case 'CONFIRMED': return 'Confirm done';
    case 'REJECTED': return 'Reject';
    case 'SENT_BACK': return 'Send back';
    default: return to;
  }
}

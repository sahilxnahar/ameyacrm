// Client-safe catalogue of webhook events (no server-only imports).

export const WEBHOOK_EVENTS = [
  { key: 'lead.created', label: 'Lead created', blurb: 'A new enquiry was captured.' },
  { key: 'lead.stage_changed', label: 'Lead stage changed', blurb: 'An enquiry moved to a new stage (e.g. won, lost).' },
  { key: 'task.created', label: 'Task created', blurb: 'A new task was raised.' },
  { key: 'task.status_changed', label: 'Task status changed', blurb: 'A task changed status (e.g. done).' },
] as const;

export type WebhookEventKey = (typeof WEBHOOK_EVENTS)[number]['key'];

export const WEBHOOK_EVENT_KEYS = WEBHOOK_EVENTS.map((e) => e.key) as readonly string[];

/** Map an automation trigger to its webhook event, when there is one. */
export const TRIGGER_TO_EVENT: Record<string, WebhookEventKey> = {
  LEAD_CREATED: 'lead.created',
  LEAD_STAGE_CHANGED: 'lead.stage_changed',
  TASK_CREATED: 'task.created',
  TASK_STATUS_CHANGED: 'task.status_changed',
};

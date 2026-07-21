/**
 * What the automation engine can actually do.
 *
 * One list, used by three things: the builder UI, the AI that writes rules from
 * a sentence, and the verifier. Keeping them in step matters more than it
 * sounds — an AI that invents a plausible-looking action produces a rule that
 * saves, looks correct in the list, and then does nothing at all when it fires,
 * because the engine falls through to "unknown action". A rule that silently
 * does nothing is worse than no rule, since you stop watching the thing it was
 * supposed to handle.
 *
 * If you add a `case` to src/lib/automation/engine.ts, add it here too. The
 * verifier fails the build if these two drift apart.
 */

import { PAYLOAD_FIELDS } from '@/lib/automation/payload';

export const AUTOMATION_TRIGGERS = [
  {
    value: 'LEAD_CREATED',
    label: 'A new enquiry arrives',
    fires: 'The moment a lead is created, however it came in — website, walk-in, or typed by hand.',
    fields: PAYLOAD_FIELDS.LEAD_CREATED,
  },
  {
    value: 'LEAD_STAGE_CHANGED',
    label: 'An enquiry moves stage',
    fires: 'Whenever a lead\'s status changes — for example NEW to QUALIFIED, or anything to LOST.',
    fields: PAYLOAD_FIELDS.LEAD_STAGE_CHANGED,
  },
  {
    value: 'TASK_CREATED',
    label: 'A task is created',
    fires: 'As soon as any task is added, by a person or by another automation.',
    fields: PAYLOAD_FIELDS.TASK_CREATED,
  },
  {
    value: 'TASK_STATUS_CHANGED',
    label: 'A task changes status',
    fires: 'When a task moves between TODO, IN_PROGRESS, BLOCKED and DONE.',
    fields: PAYLOAD_FIELDS.TASK_STATUS_CHANGED,
  },
  {
    value: 'SCHEDULE',
    label: 'Once a day',
    fires: 'Runs on the daily schedule rather than reacting to anything. Use for chasing and reminders.',
    fields: PAYLOAD_FIELDS.SCHEDULE,
  },
];

export type AutomationTriggerValue = keyof typeof PAYLOAD_FIELDS;

export const AUTOMATION_ACTIONS = [
  {
    type: 'ASSIGN_ROUND_ROBIN',
    label: 'Share out in turn',
    describe: 'Gives the lead to the next person on a list, taking it in turns.',
    params: [{ key: 'userIds', kind: 'users', required: true, note: 'Who is in the rotation.' }],
    leadOnly: true,
  },
  {
    type: 'ASSIGN_USER',
    label: 'Give it to one person',
    describe: 'Always assigns to the same person.',
    params: [{ key: 'userId', kind: 'user', required: true, note: 'Who receives it.' }],
    leadOnly: true,
  },
  {
    type: 'NOTIFY_ROLE',
    label: 'Tell everyone with a role',
    describe: 'Notifies everyone holding a role, so it keeps working when people leave.',
    params: [
      { key: 'role', kind: 'role', required: true, note: 'MANAGER, ADMIN or DEPARTMENT_HEAD.' },
      { key: 'title', kind: 'text', required: false, note: 'What the notification says.' },
    ],
    leadOnly: false,
  },
  {
    type: 'NOTIFY_USER',
    label: 'Tell one person',
    describe: 'Sends a notification to a named person.',
    params: [
      { key: 'userId', kind: 'user', required: true, note: 'Who to tell.' },
      { key: 'title', kind: 'text', required: false, note: 'What the notification says.' },
    ],
    leadOnly: false,
  },
  {
    type: 'UPDATE_LEAD_STATUS',
    label: 'Move the enquiry to a stage',
    describe: 'Changes the lead\'s status.',
    params: [{ key: 'status', kind: 'leadStatus', required: true, note: 'The stage to move it to.' }],
    leadOnly: true,
  },
  {
    type: 'CREATE_TASK',
    label: 'Create a task',
    describe: 'Raises a task so the work is on somebody\'s list, not in somebody\'s head.',
    params: [
      { key: 'title', kind: 'text', required: false, note: 'What the task says.' },
      { key: 'dueInDays', kind: 'number', required: false, note: 'Days from now until it is due.' },
      { key: 'priority', kind: 'priority', required: false, note: 'LOW, MEDIUM, HIGH or URGENT.' },
      { key: 'assigneeId', kind: 'user', required: false, note: 'Who does it. Leave blank for unassigned.' },
    ],
    leadOnly: false,
  },
  {
    type: 'SEND_EMAIL_TEMPLATE',
    label: 'Send an email from a template',
    describe: 'Sends a saved email template, with the record\'s details filled in.',
    params: [
      { key: 'templateKey', kind: 'emailTemplate', required: true, note: 'Which template to send.' },
      { key: 'to', kind: 'text', required: true, note: '"lead" to email the enquirer, or an address.' },
    ],
    leadOnly: false,
  },
] as const;

export type AutomationActionType = (typeof AUTOMATION_ACTIONS)[number]['type'];

export const AUTOMATION_OPERATORS = [
  { op: 'eq', label: 'is' },
  { op: 'neq', label: 'is not' },
  { op: 'contains', label: 'contains' },
  { op: 'not_contains', label: 'does not contain' },
  { op: 'gt', label: 'is more than' },
  { op: 'gte', label: 'is at least' },
  { op: 'lt', label: 'is less than' },
  { op: 'lte', label: 'is at most' },
  { op: 'in', label: 'is one of' },
  { op: 'not_in', label: 'is none of' },
  { op: 'is_set', label: 'has a value' },
  { op: 'is_empty', label: 'is blank' },
  { op: 'is_true', label: 'is yes' },
  { op: 'is_false', label: 'is no' },
] as const;

export const TRIGGER_VALUES = AUTOMATION_TRIGGERS.map((t) => t.value) as readonly string[];
export const ACTION_TYPES = AUTOMATION_ACTIONS.map((a) => a.type) as readonly string[];
export const OPERATOR_VALUES = AUTOMATION_OPERATORS.map((o) => o.op) as readonly string[];

/** Fields a rule may test, given its trigger. */
export function fieldsForTrigger(trigger: string): readonly string[] {
  return AUTOMATION_TRIGGERS.find((t) => t.value === trigger)?.fields ?? [];
}

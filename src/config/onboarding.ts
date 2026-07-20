/**
 * The first-day checklist. Ordered so each step makes the next one possible.
 *
 * Lives here rather than in the actions file because a Next.js `'use server'`
 * module may only export async functions — exporting this array from there
 * fails the build.
 */
export interface Step {
  key: string;
  title: string;
  body: string;
  href: string;
  permission?: string;
  adminOnly?: boolean;
}

export const ONBOARDING: Step[] = [
  { key: 'profile', title: 'Check your details', body: 'Your name, phone and WhatsApp number — these appear on everything you send.', href: '/settings' },
  { key: 'password', title: 'Set a password you will remember', body: 'Minimum eight characters. Turn on two-factor while you are there.', href: '/settings/security' },
  { key: 'install', title: 'Put the app on your phone', body: 'Takes a minute. Without it you will not get reminders when work is overdue.', href: '/install' },
  { key: 'today', title: 'Look at Today’s Priorities', body: 'This is the screen to open every morning — everything due, in one list.', href: '/today' },
  { key: 'lead', title: 'Log one real enquiry', body: 'Add a lead you took this week. The habit matters more than the record.', href: '/sales' },
  { key: 'social', title: 'Link your social handles', body: 'So an Instagram or LinkedIn enquiry reaches you and not somebody else.', href: '/social-accounts' },
  { key: 'import', title: 'Import your units and bookings', body: 'Paste from Excel. Until this is done, most of the CRM has nothing to show.', href: '/admin/import', adminOnly: true },
  { key: 'team', title: 'Set who reports to whom', body: 'Reporting lines decide who can see whose work.', href: '/team', adminOnly: true },
  { key: 'company', title: 'Confirm the GST and bank details', body: 'These print on every invoice — worth checking once, carefully.', href: '/admin/company', adminOnly: true },
];

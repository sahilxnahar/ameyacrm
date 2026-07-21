import type { LucideIcon } from 'lucide-react';
import {
  ShieldCheck, Mail, Palette, Zap, Lock, ShieldAlert, Percent, SlidersHorizontal, KeyRound,
  UserPlus, Network, Bug, Building2, Smartphone, Upload, Plug, Type, Store, Sparkles,
  Landmark, Link2, MessageSquare, Gauge, Users2, FileText, Wallet,
} from 'lucide-react';

export interface AdminTool {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  /** Extra words people might search for that are not in the title. */
  keywords?: string;
  permission?: string;
}

export interface AdminGroup { label: string; blurb: string; tools: AdminTool[] }

/**
 * The admin console, grouped the way somebody actually thinks about the job
 * rather than as one long wall of tiles.
 */
export const ADMIN_GROUPS: AdminGroup[] = [
  {
    label: 'People & access',
    blurb: 'Who is in the system, what they can reach, and how they sign in.',
    tools: [
      { href: '/admin/access-requests', icon: UserPlus, title: 'Access Requests', desc: 'Approve people who signed themselves up', keywords: 'join signup pending approve' },
      { href: '/admin/departments', icon: Network, title: 'Departments', desc: 'Divisions, teams and who heads each', keywords: 'team division org structure' },
      { href: '/admin/permissions', icon: ShieldCheck, title: 'Roles & Permissions', desc: 'Toggle what each role can do', keywords: 'rbac role access rights' },
      { href: '/admin/finance-access', icon: Landmark, title: 'Finance Access', desc: 'Who may see expenses, payments and the cash book', keywords: 'money ledger restrict', permission: 'finance.access.manage' },
      { href: '/admin/sso', icon: KeyRound, title: 'Single Sign-On', desc: 'Sign in with Google Workspace', keywords: 'saml google login' },
      { href: '/admin/security', icon: Lock, title: 'Security Policy', desc: 'Enforce 2FA and login rules', keywords: 'password 2fa mfa country' },
      { href: '/admin/security-center', icon: ShieldAlert, title: 'Security Center', desc: 'Logins, sessions, backup', keywords: 'sessions devices audit breach' },
      { href: '/admin/api-tokens', icon: KeyRound, title: 'API Tokens', desc: 'Programmatic access', keywords: 'api key integration token' },
    ],
  },
  {
    label: 'Company & money',
    blurb: 'The details that appear on anything you send out.',
    tools: [
      { href: '/admin/company', icon: Building2, title: 'Company Details', desc: 'GST, bank and addresses for invoices', keywords: 'gstin pan bank ifsc address' },
      { href: '/admin/branding', icon: Palette, title: 'Branding', desc: 'Name, tagline, colours', keywords: 'logo colour theme' },
      { href: '/admin/collections', icon: Percent, title: 'Collections & Tax', desc: 'Interest rate, default GST', keywords: 'gst tax interest penalty' },
    ],
  },
  {
    label: 'Messages & automation',
    blurb: 'What the CRM sends, and what it does without being asked.',
    tools: [
      { href: '/admin/message-templates', icon: MessageSquare, title: 'Templates', desc: 'WhatsApp, email, SMS, letters and ad copy', keywords: 'whatsapp ad google meta letter template' },
      { href: '/admin/templates', icon: Mail, title: 'System Emails', desc: 'The built-in emails the CRM sends automatically', keywords: 'email notification wording' },
      { href: '/admin/automations', icon: Zap, title: 'Automations', desc: 'Rules that assign, notify and follow up', keywords: 'rule trigger workflow' },
      { href: '/admin/connections', icon: Link2, title: 'Connected Accounts', desc: 'WhatsApp, Meta, Google Ads', keywords: 'whatsapp waba meta facebook google ads oauth' },
      { href: '/admin/mobile-app', icon: Smartphone, title: 'Mobile App & Reminders', desc: 'APK link, push coverage, overdue chasing', keywords: 'apk pwa push install' },
    ],
  },
  {
    label: 'Data & AI',
    blurb: 'What is in the system, and what the AI can see.',
    tools: [
      { href: '/admin/import', icon: Upload, title: 'Import Data', desc: 'Paste units, bookings, leads and expenses from Excel', keywords: 'excel csv paste bulk upload' },
      { href: '/admin/ai-health', icon: Sparkles, title: 'AI Health', desc: 'Test the AI for real and see what came back', keywords: 'gemini ai key index' },
      { href: '/admin/fields', icon: SlidersHorizontal, title: 'Custom Fields', desc: 'Add your own fields to any record', keywords: 'custom field form' },
      { href: '/admin/customisation', icon: Type, title: 'Words & Stages', desc: 'Rename things, configure the pipeline', keywords: 'rename label stage pipeline' },
      { href: '/admin/marketplace', icon: Store, title: 'Free Extras', desc: 'Ready-made automations, templates and views', keywords: 'marketplace extras presets' },
      { href: '/admin/privacy', icon: ShieldCheck, title: 'Privacy & DPDP', desc: 'Consent, retention, data requests', keywords: 'dpdp gdpr consent retention' },
    ],
  },
  {
    label: 'System health',
    blurb: 'Whether it is working, and how fast.',
    tools: [
      { href: '/admin/performance', icon: Gauge, title: 'Performance', desc: 'Measure why a page feels slow', keywords: 'slow speed latency database pooling' },
      { href: '/admin/errors', icon: Bug, title: 'Errors', desc: 'What has crashed, and how often', keywords: 'crash exception log' },
      { href: '/admin/integrations', icon: Plug, title: 'Integrations', desc: 'What is connected and what is working', keywords: 'status health connected' },
      { href: '/admin/feedback', icon: MessageSquare, title: 'Feedback', desc: 'What people told us about the app', keywords: 'feedback suggestion complaint rating' },
    ],
  },
];

export const ALL_ADMIN_TOOLS: AdminTool[] = ADMIN_GROUPS.flatMap((g) => g.tools);

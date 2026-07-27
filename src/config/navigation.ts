import {
  LayoutDashboard, CheckSquare, Inbox, Users2, FolderOpen, Receipt, Mail, Calendar,
  BarChart3, Shield, ScrollText, Settings, Megaphone, KeyRound, PencilRuler, Globe2, Building2, ClipboardCheck, Handshake, UserRound, LineChart, BellRing, Sparkles, Mic, ListChecks, IndianRupee, type LucideIcon,
  Network,
  TrendingUp,
  MapPin,
  AtSign,
  MessageCircleQuestion,
  LayoutGrid,
  HardHat,
  MailPlus,
  Wallet, BadgeIndianRupee, HandCoins, Camera, Gauge, FileText, BookOpen, Target, Landmark, Banknote, GanttChartSquare, PiggyBank, Scale, Package, ShieldCheck, Leaf, HelpCircle, Bot, Radio, Activity, Bell, PieChart, Repeat, LockKeyhole, Home, MessageSquarePlus, Car, Gavel, QrCode, Zap, Wrench, FileJson, Plug, Braces, BadgeCheck } from 'lucide-react';
import type { PermissionKey } from '@/lib/rbac/permissions';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  /** One plain-language line: what this screen is for, in words a newcomer knows. */
  blurb?: string;
}
export interface NavGroup {
  label: string;
  /** A short description of the whole section, shown when the menu is customised. */
  blurb?: string;
  items: NavItem[];
}

/**
 * The menu is grouped by the job you are doing, not by the part of the software
 * it lives in. A newcomer looking for "how do I take a payment" scans "Money",
 * not a single 40-item list. Every item carries a `blurb` — a plain-language
 * line the sidebar and the command palette can show so nobody has to guess what
 * a screen does. Groups are collapsible (see the sidebar), so the sections you
 * never touch stay shut.
 */
export const NAVIGATION: NavGroup[] = [
  {
    label: 'My Day',
    blurb: 'The screens to open every morning.',
    items: [
      { label: 'Home', href: '/home', icon: Home, blurb: 'Your welcome screen — the weather, the time and today’s agenda.' },
      { label: "Today's Priorities", href: '/today', icon: ListChecks, blurb: 'Everything due today, in one list. Start here.' },
      { label: 'Guide', href: '/guide', icon: BookOpen, blurb: 'How to use the CRM — first steps, and a walk through every feature.' },
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view', blurb: 'Your numbers at a glance — leads, sales, cash.' },
      { label: 'Daily Briefing', href: '/briefing', icon: Sparkles, permission: 'dashboard.view', blurb: 'A short plain-English summary of what changed.' },
      { label: 'Assistant', href: '/assistant', icon: Bot, blurb: 'An AI helper for drafting, explaining and summarising.' },
      { label: 'Reminders', href: '/reminders', icon: BellRing, blurb: 'Nudges you set for yourself.' },
      { label: 'My Automations', href: '/automations', icon: Zap, blurb: 'Switch on ready-made automations that work for you — reminders, follow-ups and checks, tailored to you.' },
      { label: 'Tasks', href: '/tasks', icon: CheckSquare, permission: 'task.view', blurb: 'Your to-dos and the ones you assigned.' },
      { label: 'Approvals', href: '/approvals', icon: Inbox, blurb: 'Things waiting for your yes or no.' },
      { label: 'Notifications', href: '/notifications', icon: Bell, blurb: 'Every alert in one inbox — filter, deep-link and mark read.' },
      { label: 'Messages', href: '/chat', icon: MessageCircleQuestion, blurb: 'Chat with anyone by @username instead of internal email.' },
      { label: 'Mail & Inbox', href: '/inbox', icon: Inbox, permission: 'lead.view', blurb: 'Your Gmail inside the CRM — read incoming email, reply, and compose new ones, plus WhatsApp, all in one place.' },
      { label: 'Gmail (IMAP)', href: '/gmail', icon: Mail, permission: 'email.send', blurb: 'Your full Gmail inbox over IMAP — read every email, reply and compose, inside the CRM.' },
      { label: 'Work Requests', href: '/work-requests', icon: Handshake, permission: 'workrequest.view', blurb: 'Ask another department to get something done — and track it.' },
      { label: 'Calendar', href: '/calendar', icon: Calendar, permission: 'calendar.view', blurb: 'Meetings, visits and events.' },
    ],
  },
  {
    label: 'Sales & Leads',
    blurb: 'Enquiries, follow-ups and the people who send them.',
    items: [
      { label: 'Sales & Leads', href: '/sales', icon: Users2, permission: 'lead.view', blurb: 'Every enquiry and where it is in the pipeline.' },
      { label: 'Walk-ins', href: '/walk-ins', icon: UserRound, permission: 'lead.view', blurb: 'People who came to the site — captured fast.' },
      { label: 'Site Visit', href: '/site-visit', icon: ClipboardCheck, permission: 'lead.create', blurb: 'Log a visit and what the buyer wanted.' },
      { label: 'NRI Desk', href: '/nri', icon: Globe2, permission: 'lead.view', blurb: 'Overseas buyers, with their time zone in mind.' },
      { label: 'Email Sequences', href: '/sequences', icon: MailPlus, permission: 'lead.view', blurb: 'Automatic follow-up emails over days.' },
      { label: 'Channel Partners', href: '/partners', icon: Handshake, permission: 'booking.view', blurb: 'Brokers who bring you buyers.' },
      { label: 'Map', href: '/map', icon: MapPin, permission: 'lead.view', blurb: 'Where your leads are, on a map.' },
    ],
  },
  {
    label: 'Inventory & Bookings',
    blurb: 'What you have to sell, and what you have sold.',
    items: [
      { label: 'Inventory', href: '/inventory', icon: Building2, permission: 'booking.view', blurb: 'Units, their status and price — what is available.' },
      { label: 'Floor Plans', href: '/floor-plans', icon: LayoutGrid, permission: 'booking.view', blurb: 'Pick a unit off the plan, visually.' },
      { label: 'Pricing & Commissions', href: '/pricing', icon: BadgeIndianRupee, permission: 'pricing.view', blurb: 'Set unit prices and broker commissions.' },
      { label: 'Buyers & Portal', href: '/customers', icon: UserRound, permission: 'booking.view', blurb: 'Your buyers and the portal they log in to.' },
      { label: 'Buyer Variations', href: '/variations', icon: Receipt, permission: 'variations.view', blurb: 'Change requests — priced and agreed before the work.' },
      { label: 'Home Loans', href: '/home-loans', icon: Landmark, permission: 'booking.view', blurb: 'Track buyer home loans — sanction, disbursement, NOC and the tripartite agreement.' },
      { label: 'Parking Matrix', href: '/parking', icon: Car, permission: 'booking.view', blurb: 'Every parking slot by level — assign each to a unit, block or free it.' },
    ],
  },
  {
    label: 'Marketing',
    blurb: 'Campaigns, the website and social handles.',
    items: [
      { label: 'Marketing', href: '/marketing', icon: Megaphone, permission: 'marketing.view', blurb: 'Campaigns, budgets and creative assets.' },
      { label: 'Marketing Library', href: '/marketing/library', icon: FolderOpen, permission: 'marketing.view', blurb: 'Renders, brochures, comparisons and brand assets — always here to view or download.' },
      { label: 'Website Audit', href: '/marketing/audit', icon: Gauge, permission: 'marketing.view', blurb: 'How the public website is performing.' },
      { label: 'Social Accounts', href: '/social-accounts', icon: AtSign, blurb: 'Link the handles enquiries come in on.' },
    ],
  },
  {
    label: 'Money',
    blurb: 'The money you handle every day. Deeper accounting lives in Accounts & Books.',
    items: [
      { label: 'Finance Command Center', href: '/finance', icon: Gauge, permission: 'treasury.view', blurb: 'Cost of capital, cash position, receivables/payables and a 12-week cash runway — one view.' },
      { label: 'Billing', href: '/billing', icon: Receipt, permission: 'billing.view', blurb: 'Invoices, purchase orders and vendor bills.' },
      { label: 'Money Owed To Us', href: '/receivables', icon: HandCoins, permission: 'billing.view', blurb: 'What buyers still owe, and when it is due.' },
      { label: 'Payment Demands', href: '/demands', icon: BellRing, permission: 'billing.view', blurb: 'Due & overdue instalments turned into automatic WhatsApp + email reminders; dunning that chases itself.' },
      { label: 'Payments Made', href: '/payments', icon: BadgeIndianRupee, permission: 'finance.ledger.view', blurb: 'Money that has gone out, with UTRs.' },
      { label: 'Borrowings', href: '/borrowings', icon: Banknote, permission: 'treasury.view', blurb: 'Bank & NBFC loans — drawdowns, outstanding and interest.' },
      { label: 'Budgets', href: '/budgets', icon: Target, permission: 'finance.ledger.view', blurb: 'What you planned to spend, versus actual.' },
      { label: 'Cash Book', href: '/cash-book', icon: Wallet, permission: 'finance.ledger.view', blurb: 'Cash in and cash out, day by day.' },
      { label: 'Accounts & Books', href: '/accounts', icon: Landmark, permission: 'finance.ledger.view', blurb: 'Ledger, Tally, GST, vendor ledgers, treasury, capital — all in one place.' },
      { label: 'TDS', href: '/tds', icon: Banknote, permission: 'finance.ledger.view', blurb: 'Tax Deducted at Source — auto-rate by section, per-account ledger, and what is deducted vs deposited vs pending.' },
    ],
  },
  {
    label: 'Build & Site',
    blurb: 'Construction, materials, drawings and safety.',
    items: [
      { label: 'Site & Attendance', href: '/field', icon: HardHat, blurb: 'Who is on site and what is happening there.' },
      { label: 'RA Bills', href: '/ra-bills', icon: HardHat, permission: 'procurement.view', blurb: 'Contractor running-account bills — IE certification, 1% BOCW cess, retention and TDS, settled in a click.' },
      { label: 'Labour Compliance', href: '/labour-compliance', icon: ShieldCheck, permission: 'procurement.view', blurb: 'EPF / ESI challans by month — blocks a labour vendor’s payment until verified.' },
      { label: 'Structural Contracts', href: '/structural-contracts', icon: HardHat, permission: 'procurement.view', blurb: 'Structural CLM — defect-liability periods and independent-engineer certification that gates each payment.' },
      { label: 'Scan (QR / Barcode)', href: '/scan', icon: QrCode, permission: 'booking.view', blurb: 'Scan a unit QR or material barcode with the camera to look it up.' },
      { label: 'Site Photos', href: '/site-photos', icon: Camera, permission: 'document.create', blurb: 'Photograph progress straight from your phone.' },
      { label: 'Site Telemetry', href: '/telemetry', icon: Radio, permission: 'telemetry.view', blurb: 'Live readings from site sensors, trackers and meters.' },
      { label: 'Voice Note', href: '/voice-note', icon: Mic, permission: 'task.create', blurb: 'Speak a note; it becomes a task.' },
      { label: 'Programme', href: '/programme', icon: GanttChartSquare, permission: 'programme.view', blurb: 'The construction schedule and progress.' },
      { label: 'Quality & Safety', href: '/quality', icon: ClipboardCheck, permission: 'quality.view', blurb: 'Inspections, safety records and permits.' },
      { label: 'Procurement (GRN)', href: '/procurement', icon: Package, permission: 'procurement.view', blurb: 'Record what arrived and check it against the order.' },
      { label: 'Material Requests', href: '/material-requests', icon: Mail, permission: 'material.view', blurb: 'Site asks for materials; office approves.' },
      { label: 'Architecture', href: '/architecture', icon: PencilRuler, permission: 'architecture.view', blurb: 'Drawings, RFIs and design issues.' },
      { label: 'Drawing Transmittals', href: '/transmittals', icon: PencilRuler, permission: 'architecture.view', blurb: 'Who was sent which drawing, and when.' },
      { label: 'Feasibility', href: '/feasibility', icon: LineChart, permission: 'feasibility.view', blurb: 'Does a project make money? Model it here.' },
      { label: 'Environment & ESG', href: '/esg', icon: Leaf, permission: 'esg.view', blurb: 'Clearance conditions and waste tracking.' },
    ],
  },
  {
    label: 'Land, Lease & Legal',
    blurb: 'Ownership, tenancies and statutory duties.',
    items: [
      { label: 'Land & Approvals', href: '/land', icon: Landmark, permission: 'land.view', blurb: 'Parcels, title chain and government approvals.' },
      { label: 'Title Chain Vault', href: '/title-vault', icon: ScrollText, permission: 'land.view', blurb: 'The 30-year chain of title — deeds, mutation extracts, EC and RTC — digitised and verifiable in one register.' },
      { label: 'Heir Mapper (JDA)', href: '/heir-mapper', icon: Users2, permission: 'land.view', blurb: 'Landowner genealogy and relinquishment deeds, so a JDA is signed by every rightful heir.' },
      { label: 'Land Conversion', href: '/land-conversion', icon: MapPin, permission: 'land.view', blurb: 'Agricultural-to-residential conversion — RTC, DC scrutiny, fee and the alienation order, stage by stage.' },
      { label: 'Arbitration & ADR', href: '/arbitration', icon: Scale, permission: 'land.view', blurb: 'Conciliation notices, arbitrator appointments, hearings and settlements — with the next hearing always in view.' },
      { label: 'REAT & High Court', href: '/appellate-litigation', icon: Gavel, permission: 'land.view', blurb: 'The appellate docket — RERA Tribunal and High Court, with interim orders, counsel and hearings.' },
      { label: 'e-Stamping', href: '/estamps', icon: ScrollText, permission: 'booking.view', blurb: 'Digital stamp-paper for agreements and deeds — SHCIL-ready, manual until the API is live.' },
      { label: 'Litigation & Renewals', href: '/litigation', icon: Gavel, permission: 'land.view', blurb: 'Court matters with full hearing history, and EC / Khata renewal alerts.' },
      { label: 'IP & Trademarks', href: '/ip-registry', icon: BadgeCheck, permission: 'document.view', blurb: 'Brand marks, TM classes and statuses, with the 10-year renewal computed and flagged automatically.' },
      { label: 'NRI / FEMA Gateway', href: '/nri-gateway', icon: Globe2, permission: 'booking.view', blurb: 'FATCA & FEMA for foreign buyers — each inward remittance with its 90-day reporting deadline watched.' },
      { label: 'Vendor Insolvency', href: '/vendor-insolvency', icon: Gavel, permission: 'finance.ledger.view', blurb: 'NCLT / IBC monitor — freezes advances to a vendor under a moratorium automatically.' },
      { label: 'Statutory Calendar', href: '/statutory', icon: Scale, permission: 'statutory.view', blurb: 'Filing and renewal dates you must not miss.' },
      { label: 'Governance & Risk', href: '/governance', icon: ShieldCheck, permission: 'governance.view', blurb: 'The risk register, contracts and insurance.' },
      { label: 'Lease', href: '/lease', icon: KeyRound, permission: 'lease.view', blurb: 'Tenants, rent schedule and maintenance.' },
      { label: 'Commercial Leasing', href: '/leasing', icon: KeyRound, permission: 'lease.view', blurb: 'The commercial rent roll.' },
      { label: 'Association & CAM', href: '/association', icon: Building2, permission: 'association.view', blurb: 'Maintenance charges and the handover to residents.' },
    ],
  },
  {
    label: 'Documents',
    blurb: 'Files, and asking questions of them.',
    items: [
      { label: 'Documents', href: '/documents', icon: FolderOpen, permission: 'document.view', blurb: 'Every file, in folders, with permissions.' },
      { label: 'Google Sheets & Drive', href: '/google', icon: FileText, permission: 'dashboard.view', blurb: 'Export CRM lists to your Google Sheet and browse your Drive files — via Apps Script, no Cloud Console.' },
      { label: 'Ask Documents', href: '/ask', icon: MessageCircleQuestion, permission: 'document.view', blurb: 'Ask a plain question; get the answer from your files.' },
      // No permission: everyone sees this, and the page itself narrows the list
      // to the departments they belong to.
      { label: 'Templates', href: '/templates', icon: FileText, blurb: 'Ready-made letters and emails to reuse.' },
      { label: 'File Tools', href: '/tools', icon: Wrench, blurb: 'Merge/split PDFs, images to PDF, and convert CSV/Excel/JSON/Markdown — on your device, no AI credits.' },
    ],
  },
  {
    label: 'Insights & Reports',
    blurb: 'Numbers, trends and data health.',
    items: [
      { label: 'Reports', href: '/reports', icon: BarChart3, permission: 'report.view', blurb: 'Ready-made reports on the whole business.' },
      { label: 'Report Builder', href: '/report-builder', icon: BarChart3, permission: 'report.view', blurb: 'Build your own report — pick, group, measure.' },
      { label: 'Insights', href: '/insights', icon: Sparkles, permission: 'report.view', blurb: 'Bills that stand out and how leads are scoring.' },
      { label: 'Analytics', href: '/analytics', icon: LineChart, permission: 'report.view', blurb: 'Deeper charts and breakdowns.' },
      { label: 'Forecast', href: '/forecast', icon: TrendingUp, permission: 'report.view', blurb: 'Where sales and cash are heading.' },
      { label: 'Data Quality', href: '/data-quality', icon: Sparkles, permission: 'data.view', blurb: 'Duplicates and gaps worth cleaning up.' },
    ],
  },
  {
    label: 'Team & Admin',
    blurb: 'Your people, the settings, and help.',
    items: [
      { label: 'Team & Hierarchy', href: '/team', icon: Network, blurb: 'Who reports to whom — this sets who sees what.' },
      { label: 'Admin', href: '/admin', icon: Shield, permission: 'admin.user.view', blurb: 'Users, roles, projects and system settings.' },
      { label: 'System Health', href: '/admin/health', icon: Activity, permission: 'admin.setting.manage', blurb: 'One board: is every part of the system working, green/amber/red.' },
      { label: 'Automations', href: '/admin/automations', icon: Zap, permission: 'admin.setting.manage', blurb: 'Company-wide automation rules — trigger, conditions, actions — and the log of every run.' },
      { label: 'My Apps', href: '/apps', icon: Package, permission: 'admin.setting.manage', blurb: 'The apps you have installed, and quick access to manage them.' },
      { label: 'App Exchange', href: '/app-exchange', icon: Plug, permission: 'admin.setting.manage', blurb: 'Browse and connect 140+ apps — CRM, payments, chat, storage, portals.' },
      { label: 'Email Health', href: '/admin/email-health', icon: Mail, permission: 'admin.setting.manage', blurb: 'Test whether password-reset and 2FA emails actually send, and get told what to fix.' },
      { label: 'Developers', href: '/developers', icon: Braces, permission: 'admin.setting.manage', blurb: 'REST API playground, OpenAPI spec, sandbox test endpoint and webhook tooling.' },
      { label: 'App Packages', href: '/admin/app-packages', icon: Package, permission: 'admin.setting.manage', blurb: 'Install ready-made bundles of fields, automations and views — or author, import and export your own.' },
      { label: 'Security Operations', href: '/security-ops', icon: KeyRound, permission: 'secops.view', blurb: 'Incidents and access reviews.' },
      { label: 'Decision Log', href: '/knowledge', icon: BookOpen, permission: 'knowledge.view', blurb: 'SOPs, decisions and lessons learned.' },
      { label: 'Audit Trail', href: '/audit', icon: ScrollText, permission: 'audit.view', blurb: 'A record of who did what.' },
      { label: 'Glossary', href: '/glossary', icon: HelpCircle, blurb: 'Plain-English meaning of any term used here.' },
      { label: 'Send Feedback', href: '/feedback', icon: MessageSquarePlus, blurb: 'Tell us what worked, what didn’t, and what you wish it did.' },
      { label: 'Explore Features', href: '/features', icon: LayoutGrid, blurb: 'A map of everything the CRM can do — search and jump to any screen.' },
      { label: "What's New", href: '/updates', icon: Sparkles, blurb: 'Every feature and update we’ve ever added — searchable, newest first.' },
      { label: 'Settings', href: '/settings', icon: Settings, blurb: 'Your profile, security and preferences.' },
    ],
  },
];

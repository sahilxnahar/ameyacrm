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
  Wallet, BadgeIndianRupee, HandCoins, Camera, Gauge, FileText, BookOpen, Target, Landmark, Banknote, GanttChartSquare, PiggyBank, Scale, Package, ShieldCheck, Leaf } from 'lucide-react';
import type { PermissionKey } from '@/lib/rbac/permissions';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: PermissionKey;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAVIGATION: NavGroup[] = [
  {
    label: 'My Day',
    items: [
      { label: "Today's Priorities", href: '/today', icon: ListChecks },
      { label: 'Daily Briefing', href: '/briefing', icon: Sparkles, permission: 'dashboard.view' },
      { label: 'Reminders', href: '/reminders', icon: BellRing },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
      { label: 'Tasks', href: '/tasks', icon: CheckSquare, permission: 'task.view' },
      { label: 'Approvals', href: '/approvals', icon: Inbox },
      { label: 'Calendar', href: '/calendar', icon: Calendar, permission: 'calendar.view' },
      { label: 'Team & Hierarchy', href: '/team', icon: Network },
      { label: 'Site & Attendance', href: '/field', icon: HardHat },
      { label: 'Social Accounts', href: '/social-accounts', icon: AtSign },
    ],
  },
  {
    label: 'Business',
    items: [
      { label: 'Sales & Leads', href: '/sales', icon: Users2, permission: 'lead.view' },
      { label: 'Email Sequences', href: '/sequences', icon: MailPlus, permission: 'lead.view' },
      { label: 'Inventory', href: '/inventory', icon: Building2, permission: 'booking.view' },
      { label: 'Pricing & Commissions', href: '/pricing', icon: BadgeIndianRupee, permission: 'pricing.view' },
      { label: 'Floor Plans', href: '/floor-plans', icon: LayoutGrid, permission: 'booking.view' },
      { label: 'Site Visit', href: '/site-visit', icon: ClipboardCheck, permission: 'lead.create' },
      { label: 'Site Photos', href: '/site-photos', icon: Camera, permission: 'document.create' },
      { label: 'Voice Note', href: '/voice-note', icon: Mic, permission: 'task.create' },
      { label: 'Channel Partners', href: '/partners', icon: Handshake, permission: 'booking.view' },
      { label: 'Buyers & Portal', href: '/customers', icon: UserRound, permission: 'booking.view' },
      { label: 'NRI Desk', href: '/nri', icon: Globe2, permission: 'lead.view' },
      { label: 'Documents', href: '/documents', icon: FolderOpen, permission: 'document.view' },
      { label: 'Ask Documents', href: '/ask', icon: MessageCircleQuestion, permission: 'document.view' },
      // No permission: everyone sees this, and the page itself narrows the list
      // to the departments they belong to.
      { label: 'Templates', href: '/templates', icon: FileText },
      { label: 'Billing', href: '/billing', icon: Receipt, permission: 'billing.view' },
      { label: 'Cash Book', href: '/cash-book', icon: Wallet, permission: 'finance.ledger.view' },
      { label: 'Ledger', href: '/ledger', icon: BookOpen, permission: 'finance.ledger.view' },
      { label: 'Budgets', href: '/budgets', icon: Target, permission: 'finance.ledger.view' },
      { label: 'Cash Flow & Treasury', href: '/treasury', icon: Banknote, permission: 'treasury.view' },
      { label: 'Capital & Escrow', href: '/capital', icon: PiggyBank, permission: 'capital.view' },
      { label: 'Payments Made', href: '/payments', icon: BadgeIndianRupee, permission: 'finance.ledger.view' },
      { label: 'Money Owed To Us', href: '/receivables', icon: HandCoins, permission: 'billing.view' },
      { label: 'Payment Requests', href: '/payment-requests', icon: IndianRupee, permission: 'billing.view' },
      { label: 'Material Requests', href: '/material-requests', icon: Mail, permission: 'material.view' },
      { label: 'Marketing', href: '/marketing', icon: Megaphone, permission: 'marketing.view' },
      { label: 'Website Audit', href: '/marketing/audit', icon: Gauge, permission: 'marketing.view' },
      { label: 'Lease', href: '/lease', icon: KeyRound, permission: 'lease.view' },
      { label: 'Architecture', href: '/architecture', icon: PencilRuler, permission: 'architecture.view' },
      { label: 'Programme', href: '/programme', icon: GanttChartSquare, permission: 'programme.view' },
      { label: 'Quality & Safety', href: '/quality', icon: ClipboardCheck, permission: 'quality.view' },
      { label: 'Procurement (GRN)', href: '/procurement', icon: Package, permission: 'procurement.view' },
      { label: 'Feasibility', href: '/feasibility', icon: LineChart, permission: 'feasibility.view' },
      { label: 'Environment & ESG', href: '/esg', icon: Leaf, permission: 'esg.view' },
      { label: 'Land & Approvals', href: '/land', icon: Landmark, permission: 'land.view' },
      { label: 'Drawing Transmittals', href: '/transmittals', icon: PencilRuler, permission: 'architecture.view' },
      { label: 'Buyer Variations', href: '/variations', icon: Receipt, permission: 'variations.view' },
      { label: 'Walk-ins', href: '/walk-ins', icon: UserRound, permission: 'lead.view' },
      { label: 'Commercial Leasing', href: '/leasing', icon: KeyRound, permission: 'lease.view' },
      { label: 'Association & CAM', href: '/association', icon: Building2, permission: 'association.view' },
      { label: 'Expense Claims', href: '/expenses', icon: HandCoins, permission: 'people.view' },
      { label: 'Forecast', href: '/forecast', icon: TrendingUp, permission: 'report.view' },
      { label: 'Map', href: '/map', icon: MapPin, permission: 'lead.view' },
      { label: 'Reports', href: '/reports', icon: BarChart3, permission: 'report.view' },
      { label: 'Report Builder', href: '/report-builder', icon: BarChart3, permission: 'report.view' },
      { label: 'Insights', href: '/insights', icon: Sparkles, permission: 'report.view' },
      { label: 'Analytics', href: '/analytics', icon: LineChart, permission: 'report.view' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Admin', href: '/admin', icon: Shield, permission: 'admin.user.view' },
      { label: 'Data Quality', href: '/data-quality', icon: Sparkles, permission: 'data.view' },
      { label: 'Statutory Calendar', href: '/statutory', icon: Scale, permission: 'statutory.view' },
      { label: 'Governance & Risk', href: '/governance', icon: ShieldCheck, permission: 'governance.view' },
      { label: 'Security Operations', href: '/security-ops', icon: KeyRound, permission: 'secops.view' },
      { label: 'Decision Log', href: '/knowledge', icon: BookOpen, permission: 'knowledge.view' },
      { label: 'Audit Trail', href: '/audit', icon: ScrollText, permission: 'audit.view' },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

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
  Wallet, BadgeIndianRupee, HandCoins, Camera, Gauge, FileText, BookOpen, Target, Landmark, Banknote } from 'lucide-react';
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
      { label: 'Payments Made', href: '/payments', icon: BadgeIndianRupee, permission: 'finance.ledger.view' },
      { label: 'Money Owed To Us', href: '/receivables', icon: HandCoins, permission: 'billing.view' },
      { label: 'Payment Requests', href: '/payment-requests', icon: IndianRupee, permission: 'billing.view' },
      { label: 'Material Requests', href: '/material-requests', icon: Mail, permission: 'material.view' },
      { label: 'Marketing', href: '/marketing', icon: Megaphone, permission: 'marketing.view' },
      { label: 'Website Audit', href: '/marketing/audit', icon: Gauge, permission: 'marketing.view' },
      { label: 'Lease', href: '/lease', icon: KeyRound, permission: 'lease.view' },
      { label: 'Architecture', href: '/architecture', icon: PencilRuler, permission: 'architecture.view' },
      { label: 'Land & Approvals', href: '/land', icon: Landmark, permission: 'land.view' },
      { label: 'Forecast', href: '/forecast', icon: TrendingUp, permission: 'report.view' },
      { label: 'Map', href: '/map', icon: MapPin, permission: 'lead.view' },
      { label: 'Reports', href: '/reports', icon: BarChart3, permission: 'report.view' },
      { label: 'Analytics', href: '/analytics', icon: LineChart, permission: 'report.view' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Admin', href: '/admin', icon: Shield, permission: 'admin.user.view' },
      { label: 'Audit Trail', href: '/audit', icon: ScrollText, permission: 'audit.view' },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

import {
  LayoutDashboard, CheckSquare, Inbox, Users2, FolderOpen, Receipt, Mail, Calendar,
  BarChart3, Shield, ScrollText, Settings, Megaphone, KeyRound, PencilRuler, Globe2, type LucideIcon,
} from 'lucide-react';
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
    label: 'Workspace',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
      { label: 'Tasks', href: '/tasks', icon: CheckSquare, permission: 'task.view' },
      { label: 'Approvals', href: '/approvals', icon: Inbox },
      { label: 'Calendar', href: '/calendar', icon: Calendar, permission: 'calendar.view' },
    ],
  },
  {
    label: 'Business',
    items: [
      { label: 'Sales & Leads', href: '/sales', icon: Users2, permission: 'lead.view' },
      { label: 'NRI Desk', href: '/nri', icon: Globe2, permission: 'lead.view' },
      { label: 'Documents', href: '/documents', icon: FolderOpen, permission: 'document.view' },
      { label: 'Billing', href: '/billing', icon: Receipt, permission: 'billing.view' },
      { label: 'Material Requests', href: '/material-requests', icon: Mail, permission: 'material.view' },
      { label: 'Marketing', href: '/marketing', icon: Megaphone, permission: 'marketing.view' },
      { label: 'Lease', href: '/lease', icon: KeyRound, permission: 'lease.view' },
      { label: 'Architecture', href: '/architecture', icon: PencilRuler, permission: 'architecture.view' },
      { label: 'Reports', href: '/reports', icon: BarChart3, permission: 'report.view' },
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

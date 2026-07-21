import type { RoleValue } from '@/lib/auth/role-change';

/**
 * The roles a super admin can hand out, in order of power, each with a line
 * explaining what it means in practice. The note matters: "DEPARTMENT_HEAD"
 * tells you nothing about whether that person can see finance.
 */
export const ASSIGNABLE_ROLES: Array<{ value: RoleValue; label: string; note: string }> = [
  { value: 'SUPER_ADMIN', label: 'Super admin', note: 'Everything, including finance, security and other people\'s roles.' },
  { value: 'ADMIN', label: 'Admin', note: 'Runs the system day to day. Cannot change roles.' },
  { value: 'DEPARTMENT_HEAD', label: 'Department head', note: 'Leads a department and sees its work.' },
  { value: 'MANAGER', label: 'Manager', note: 'Manages a team and approves their work.' },
  { value: 'EXECUTIVE', label: 'Executive', note: 'Handles leads, tasks and customers.' },
  { value: 'EMPLOYEE', label: 'Employee', note: 'The normal role for most people.' },
  { value: 'READ_ONLY', label: 'Read only', note: 'Can look, cannot change anything.' },
  { value: 'GUEST', label: 'Guest', note: 'Very limited. For outside parties.' },
];

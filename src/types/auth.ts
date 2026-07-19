import type { User } from '@prisma/client';
import type { PermissionSet } from '@/lib/rbac/can';

export type SafeUser = Omit<User, 'passwordHash' | 'twoFactorSecret'>;

export interface AuthContext {
  user: SafeUser;
  permissions: PermissionSet;
  sessionId: string;
}

export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
}

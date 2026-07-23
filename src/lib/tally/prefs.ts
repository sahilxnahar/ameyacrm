// Client-safe per-user Ameya Tally preferences (no server-only imports).
import { VOUCHER_TYPES } from '@/config/tally-groups';

export type TallyOs = 'auto' | 'mac' | 'windows';
export type TallyPeriodPref = 'month' | 'quarter' | 'fy' | 'all';

export interface TallyPrefs {
  companyName: string;
  defaultVoucher: string;
  defaultPeriod: TallyPeriodPref;
  os: TallyOs;
}

export const DEFAULT_TALLY_PREFS: TallyPrefs = {
  companyName: 'Ameya Heights LLP',
  defaultVoucher: 'Payment',
  defaultPeriod: 'all',
  os: 'auto',
};

export function readTallyPrefs(raw: unknown): TallyPrefs {
  if (!raw || typeof raw !== 'object') return DEFAULT_TALLY_PREFS;
  const o = raw as Record<string, unknown>;
  const str = (v: unknown, fb: string) => (typeof v === 'string' && v.trim() ? v.trim() : fb);
  const voucher = typeof o.defaultVoucher === 'string' && (VOUCHER_TYPES as readonly string[]).includes(o.defaultVoucher) ? o.defaultVoucher : DEFAULT_TALLY_PREFS.defaultVoucher;
  const period = (['month', 'quarter', 'fy', 'all'] as const).includes(o.defaultPeriod as TallyPeriodPref) ? (o.defaultPeriod as TallyPeriodPref) : 'all';
  const os = (['auto', 'mac', 'windows'] as const).includes(o.os as TallyOs) ? (o.os as TallyOs) : 'auto';
  return {
    companyName: str(o.companyName, DEFAULT_TALLY_PREFS.companyName).slice(0, 80),
    defaultVoucher: voucher,
    defaultPeriod: period,
    os,
  };
}

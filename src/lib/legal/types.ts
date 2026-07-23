// Client-safe legal/docket types (no server-only imports).

export interface HearingRow { id: string; date: string; purpose: string | null; outcome: string | null; nextDate: string | null; notes: string | null }
export interface DocketMatter {
  id: string; title: string; court: string | null; caseNumber: string | null; counsel: string | null;
  status: string; nextHearing: string | null; exposure: number | null; summary: string | null; projectId: string | null;
  hearings: HearingRow[];
}
export interface LitigationDocket {
  matters: DocketMatter[];
  projects: Array<{ id: string; name: string }>;
  projectId: string | null;
}

export type RenewalState = 'expired' | 'soon' | 'ok' | 'untracked';
export interface RenewalRow {
  id: string; parcelId: string; parcelName: string; kind: string; title: string;
  expiresOn: string | null; daysToExpiry: number | null; state: RenewalState; renewalNote: string | null;
}
export interface DocRenewals { rows: RenewalRow[]; expired: number; soon: number; tracked: number; total: number }

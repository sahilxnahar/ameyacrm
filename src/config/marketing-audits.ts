/** Shared between the audit service and the screen — no server code here. */
export type AuditKind = 'LANDING' | 'SEO' | 'AEO' | 'COMPETITORS' | 'ADS';

export interface Finding { severity: 'high' | 'medium' | 'low'; title: string; detail: string; fix: string }

export interface AuditResult {
  id: string;
  kind: AuditKind;
  url: string;
  score: number | null;
  summary: string;
  findings: Finding[];
  output: unknown;
  error: string | null;
}

export const AUDIT_KINDS: Array<{ key: AuditKind; label: string; blurb: string }> = [
  { key: 'LANDING', label: 'Landing page', blurb: 'Does the page persuade? Headline, proof, and whether the next step is obvious.' },
  { key: 'SEO', label: 'Search (SEO)', blurb: 'Whether Google can understand and rank the page.' },
  { key: 'AEO', label: 'AI answers (AEO)', blurb: 'Whether ChatGPT and Gemini can quote you when someone asks about builders in Bangalore.' },
  { key: 'COMPETITORS', label: 'Competitor comparison', blurb: "Your page against another developer's, side by side." },
  { key: 'ADS', label: 'Ad copy', blurb: 'Headlines and body for Google and Meta, written from what the page actually says.' },
];

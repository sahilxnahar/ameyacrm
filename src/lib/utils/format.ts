import { format, formatDistanceToNow, isValid } from 'date-fns';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export function formatCurrency(value: number | string | null | undefined): string {
  if (value == null) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? inr.format(n) : '—';
}

export function formatDate(d: Date | string | null | undefined, pattern = 'dd MMM yyyy'): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return isValid(date) ? format(date, pattern) : '—';
}

export function formatDateTime(d: Date | string | null | undefined): string {
  return formatDate(d, 'dd MMM yyyy, h:mm a');
}

export function timeAgo(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return isValid(date) ? formatDistanceToNow(date, { addSuffix: true }) : '—';
}

export function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

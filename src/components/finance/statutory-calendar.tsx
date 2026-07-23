import { CalendarClock } from 'lucide-react';
import { Card } from '@/components/ui/card';

/**
 * The recurring Indian statutory due dates a developer must not miss. Static
 * reference — dates are monthly/quarterly deadlines, not tied to your data.
 */
const DUES: { day: string; what: string }[] = [
  { day: '7th', what: 'TDS deposit — tax deducted the previous month' },
  { day: '11th', what: 'GSTR-1 — outward supplies (monthly filers)' },
  { day: '20th', what: 'GSTR-3B — summary return + GST payment' },
  { day: '15th (quarterly)', what: 'Advance tax instalment (Jun / Sep / Dec / Mar)' },
  { day: '30th Apr', what: 'TDS Q4 return (Form 26Q) & Form 16A issuance' },
];

export function StatutoryCalendar() {
  return (
    <Card className="p-4">
      <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><CalendarClock className="h-4 w-4 text-[#A07D34]" /> Statutory due dates</p>
      <p className="mb-3 text-xs text-muted-foreground">The recurring deadlines to keep in mind. Missing them costs interest and penalties.</p>
      <ul className="space-y-1.5 text-sm">
        {DUES.map((d) => (
          <li key={d.day} className="flex gap-3">
            <span className="w-28 shrink-0 font-medium tabular-nums">{d.day}</span>
            <span className="text-muted-foreground">{d.what}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

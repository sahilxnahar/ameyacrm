import { describe, it, expect } from 'vitest';
import { buildIcs } from '@/lib/calendar/ics';

describe('ICS builder', () => {
  it('produces a valid VCALENDAR with an event', () => {
    const ics = buildIcs([{ id: 'e1', title: 'Site Visit', start: new Date('2026-08-01T10:00:00Z') }]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Site Visit');
    expect(ics).toContain('END:VCALENDAR');
  });
});

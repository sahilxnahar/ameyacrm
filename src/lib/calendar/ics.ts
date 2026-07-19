interface IcsEvent { id: string; title: string; description?: string | null; location?: string | null; start: Date; end?: Date | null; allDay?: boolean }

function fmt(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Minimal, spec-compliant iCalendar generator (RFC 5545). */
export function buildIcs(events: IcsEvent[], calName = 'Ameya Heights CRM'): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ameya Heights//CRM//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${calName}`];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.id}@ameyaheights.com`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(e.start)}`);
    if (e.end) lines.push(`DTEND:${fmt(e.end)}`);
    lines.push(`SUMMARY:${(e.title || '').replace(/\n/g, ' ')}`);
    if (e.description) lines.push(`DESCRIPTION:${e.description.replace(/\n/g, '\\n')}`);
    if (e.location) lines.push(`LOCATION:${e.location}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

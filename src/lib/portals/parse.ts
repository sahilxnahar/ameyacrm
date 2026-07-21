/**
 * Turn a portal's notification email into a lead.
 *
 * 99acres, MagicBricks and Housing.com all email you the moment somebody
 * enquires. Their partner APIs need a paid listing account and a contract;
 * these emails need neither, and they arrive at the same moment.
 */
export type PortalName = '99acres' | 'MagicBricks' | 'Housing' | 'CommonFloor' | 'NoBroker' | 'Unknown';

export interface PortalLead {
  portal: PortalName;
  name: string | null;
  phone: string | null;
  email: string | null;
  requirement: string | null;
  project: string | null;
  raw: string;
}

const SENDERS: Array<[RegExp, PortalName]> = [
  [/99acres\.com/i, '99acres'],
  [/magicbricks\.com/i, 'MagicBricks'],
  [/housing\.com|proptiger/i, 'Housing'],
  [/commonfloor\.com/i, 'CommonFloor'],
  [/nobroker\.in/i, 'NoBroker'],
];

export function portalFor(from: string, subject = ''): PortalName {
  const hay = `${from} ${subject}`;
  for (const [re, name] of SENDERS) if (re.test(hay)) return name;
  return 'Unknown';
}

const PHONE = /(?:\+?91[-\s]?)?[6-9]\d{9}/;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/;

/** Pull "Label : value" out of the body — every portal uses some version of this. */
function labelled(body: string, labels: string[]): string | null {
  for (const l of labels) {
    const re = new RegExp(`${l}\\s*[:\\-]\\s*(.+)`, 'i');
    const m = body.match(re);
    if (m) {
      const v = (m[1] ?? '').split('\n')[0]?.trim() ?? '';
      if (v && v.length < 200) return v;
    }
  }
  return null;
}

export function parsePortalEmail(from: string, subject: string, body: string): PortalLead {
  const portal = portalFor(from, subject);
  const text = body.replace(/\r/g, '');

  let name = labelled(text, ['Name', 'Customer Name', 'Buyer Name', 'Enquirer', 'Contact Name', 'Posted By']);
  const phone = labelled(text, ['Mobile', 'Phone', 'Contact No', 'Contact Number', 'Mobile No'])?.match(PHONE)?.[0]
    ?? text.match(PHONE)?.[0] ?? null;
  const email = labelled(text, ['Email', 'Email ID', 'E-mail'])?.match(EMAIL)?.[0]?.toLowerCase()
    ?? text.match(EMAIL)?.[0]?.toLowerCase() ?? null;

  // Ignore the portal's own address if that is all we found.
  const cleanEmail = email && !/99acres|magicbricks|housing|commonfloor|nobroker|noreply|no-reply/i.test(email) ? email : null;

  const requirement = labelled(text, ['Message', 'Requirement', 'Query', 'Comments', 'Remarks', 'Looking for']);
  const project = labelled(text, ['Property', 'Project', 'Listing', 'Property Name', 'Regarding']);

  // Some templates put the name only in the subject: "New response from Ramesh Kumar".
  if (!name) {
    const m = subject.match(/(?:from|by|of)\s+([A-Z][A-Za-z.\s]{2,40})$/);
    if (m?.[1]) name = m[1].trim();
  }

  return { portal, name, phone, email: cleanEmail, requirement, project, raw: text.slice(0, 2000) };
}

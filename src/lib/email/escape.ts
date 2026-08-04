/**
 * Escape a value for interpolation into an HTML email body.
 *
 * ── AMH-048 ─────────────────────────────────────────────────────────────────
 *
 * Four copies of this function existed — chat-nudge, task-digest, the task-act
 * route and party-reminder each defined their own — and three other places
 * interpolated `user.name` into an HTML mail body with no escaping at all.
 *
 * The consequence is smaller than a web XSS: mail clients sandbox HTML hard, so
 * this is not script execution. It is CONTENT injection. A display name is
 * user-settable, and a name like
 *
 *     Priya</p><p>Your account was suspended. Click here to restore it:
 *
 * turns a legitimate, correctly-signed message from Ameya's own mail server
 * into a phishing page — the recipient's client shows a valid DKIM signature
 * for ameyaheights.com above whatever the attacker wrote.
 *
 * One copy, in the email layer, so the next person writing a template imports
 * it rather than deciding whether this particular field needs it.
 */
const REPLACEMENTS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string | null | undefined): string {
  if (value == null) return '';
  return String(value).replace(/[&<>"']/g, (c) => REPLACEMENTS[c] ?? c);
}

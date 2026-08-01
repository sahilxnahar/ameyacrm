#!/usr/bin/env node
/**
 * Ameya Tally Bridge — live sync from a local Tally into Ameya CRM.
 *
 * Run this on the Windows/Mac machine that has Tally open. It talks to Tally on
 * 127.0.0.1:9000 (Tally's own XML gateway) and PUSHES the result to your Ameya
 * CRM over HTTPS.
 *
 *   Why push and not pull? Your CRM lives on the internet and Tally lives on
 *   your office LAN. Rather than exposing Tally through your router (which would
 *   be a serious security risk), this agent reaches out. Nothing needs to be
 *   opened on your firewall.
 *
 * SETUP (once)
 *   1. In Tally: F1 (Help) → Settings → Connectivity → Client/Server configuration
 *      → set "Tally acts as" = Both, Port = 9000. Keep Tally running with the
 *      company open.
 *   2. In Ameya (Vercel env): set TALLY_BRIDGE_SECRET to a long random string.
 *   3. Set the same value in AMEYA_KEY below (or as an environment variable).
 *
 * USAGE
 *   node ameya-tally-bridge.mjs                     # sync the last 30 days
 *   node ameya-tally-bridge.mjs --days 365          # sync the last year
 *   node ameya-tally-bridge.mjs --from 2024-04-01 --to 2025-03-31
 *   node ameya-tally-bridge.mjs --masters-only      # chart of accounts only
 *
 * Schedule it with Windows Task Scheduler (or cron) to keep Ameya in step.
 * Re-sending an overlapping period is safe — Ameya skips vouchers it already has.
 */

const AMEYA_URL = process.env.AMEYA_URL || 'https://crm.ameyaheights.com';
const AMEYA_KEY = process.env.TALLY_BRIDGE_SECRET || '';   // must match Ameya's env var
const TALLY_URL = process.env.TALLY_URL || 'http://127.0.0.1:9000';
const COMPANY   = process.env.TALLY_COMPANY || '';          // blank = Tally's current company

const args = process.argv.slice(2);
const flag = (n, d = null) => { const i = args.indexOf(`--${n}`); return i >= 0 ? (args[i + 1] ?? true) : d; };
const has  = (n) => args.includes(`--${n}`);

const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
const days = Number(flag('days', 30));
const toDate   = flag('to')   ? new Date(String(flag('to')))   : new Date();
const fromDate = flag('from') ? new Date(String(flag('from'))) : new Date(Date.now() - days * 86400000);

function envelope(reportName, extra = '') {
  return `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>${reportName}</ID></HEADER>` +
    `<BODY><DESC><STATICVARIABLES>` +
    `<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>` +
    (COMPANY ? `<SVCURRENTCOMPANY>${COMPANY}</SVCURRENTCOMPANY>` : '') +
    extra +
    `</STATICVARIABLES></DESC></BODY></ENVELOPE>`;
}

async function askTally(xmlRequest, label) {
  process.stdout.write(`  → asking Tally for ${label}… `);
  const res = await fetch(TALLY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml;charset=utf-8' },
    body: xmlRequest,
  });
  if (!res.ok) throw new Error(`Tally replied ${res.status}. Is Tally running with the gateway enabled on ${TALLY_URL}?`);
  const text = await res.text();
  console.log(`${(text.length / 1024).toFixed(0)} KB`);
  return text;
}

async function pushToAmeya(xml, label) {
  process.stdout.write(`  → sending ${label} to Ameya… `);
  const res = await fetch(`${AMEYA_URL.replace(/\/$/, '')}/api/v1/tally/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tally-bridge-key': AMEYA_KEY },
    body: JSON.stringify({ company: COMPANY || undefined, xml }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.log('FAILED');
    if (res.status === 503) throw new Error('Ameya says the bridge is not configured — set TALLY_BRIDGE_SECRET in Vercel.');
    if (res.status === 401) throw new Error('Ameya rejected the key — TALLY_BRIDGE_SECRET here must match the one in Vercel.');
    throw new Error(json.error || `Ameya replied ${res.status}`);
  }
  console.log('ok');
  return json;
}

(async () => {
  console.log('Ameya Tally Bridge');
  console.log(`  Tally : ${TALLY_URL}`);
  console.log(`  Ameya : ${AMEYA_URL}`);
  console.log(`  Period: ${fromDate.toISOString().slice(0, 10)} → ${toDate.toISOString().slice(0, 10)}`);
  if (!AMEYA_KEY) {
    console.error('\n✗ No key. Set TALLY_BRIDGE_SECRET (same value as in Vercel) and run again.');
    process.exit(1);
  }
  try {
    // 1) Masters — chart of accounts, stock items, cost centres.
    const masters = await askTally(envelope('List of Accounts'), 'masters');
    const r1 = await pushToAmeya(masters, 'masters');
    console.log(`     ledgers ${r1.ledgers ?? 0} · stock ${r1.stockItems ?? 0} · cost centres ${r1.costCentres ?? 0}`);

    // 2) Transactions — the Day Book for the window.
    if (!has('masters-only')) {
      const daybook = await askTally(
        envelope('Day Book', `<SVFROMDATE>${ymd(fromDate)}</SVFROMDATE><SVTODATE>${ymd(toDate)}</SVTODATE>`),
        'day book',
      );
      const r2 = await pushToAmeya(daybook, 'day book');
      console.log(`     vouchers added ${r2.vouchersCreated ?? 0} · already present ${r2.vouchersSkipped ?? 0}`);
      for (const w of r2.warnings ?? []) console.log(`     ! ${w}`);
    }
    console.log('\n✓ Sync complete.');
  } catch (e) {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
})();

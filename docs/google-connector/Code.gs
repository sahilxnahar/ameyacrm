/**
 * Ameya Heights CRM — Google connector (personal account, no Cloud Console, no billing).
 *
 * This one file now does three jobs:
 *   A. Drive uploads + Sheets export   (doPost — already working, unchanged)
 *   B. Social capture from Gmail       (scanSocialOnce — hourly trigger)
 *   C. Hourly overdue reminders        (pingEscalation — hourly trigger)
 *
 * ── FIRST-TIME SETUP (already done for part A) ────────────────────────────
 *  1. script.google.com → New project → paste this file.
 *  2. Fill in FOLDER_ID and SHEET_ID below.
 *  3. Deploy → New deployment → Web app
 *        Execute as:      Me
 *        Who has access:  Anyone
 *     → Deploy → Authorize → copy the /exec URL.
 *  4. In Vercel: GAS_WEBAPP_URL = that URL, GAS_SECRET = the SECRET below.
 *
 * ── AFTER PASTING THIS UPDATE ─────────────────────────────────────────────
 *  5. Fill in CRON_KEY and INGEST_KEY below (see the CRM deploy notes).
 *  6. Save. Click Run with "pingEscalation" selected → approve the permissions.
 *  7. Run "scanSocialOnce" once → approve the Gmail permission.
 *  8. Left sidebar → the clock icon (Triggers) → Add Trigger, twice:
 *        pingEscalation  · Time-driven · Hour timer · Every hour
 *        scanSocialOnce  · Time-driven · Hour timer · Every hour
 *  9. Deploy → Manage deployments → edit → Version: NEW VERSION → Deploy.
 *     (Editing the code alone does not update the live web app.)
 *
 * Files are created BY YOU, so they use your own 15GB Drive quota. No service
 * account, no API keys, no payment method.
 */

// ── Settings ───────────────────────────────────────────────────────────────
var SECRET     = '3b6b3f81ab2515276cbd09b6e15c2592464ae364';
var FOLDER_ID  = '1zkJogniKQSdLFksHIr0wQuCdECJoEQIy';   // drive.google.com/drive/folders/<THIS_ID>
var SHEET_ID   = '1iO_jlkiX6Jhq8zWyhcRwcDDZDPpOEenQPv-WaFP5hmk'; // docs.google.com/spreadsheets/d/<THIS_ID>/edit

var CRM_URL    = 'https://ameyacrm.vercel.app';   // no trailing slash
var CRON_KEY   = 'PASTE_CRON_SECRET_HERE';        // must equal CRON_SECRET in Vercel
var INGEST_KEY = 'PASTE_INGEST_SECRET_HERE';      // must equal INGEST_SECRET in Vercel


// ═══════════════════════════════════════════════════════════════════════════
//  A.  Drive uploads + Sheets export  (called by the CRM)
// ═══════════════════════════════════════════════════════════════════════════

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return out({ error: 'unauthorized' });

    if (body.action === 'ping') {
      return out({ ok: true, folder: DriveApp.getFolderById(FOLDER_ID).getName() });
    }

    if (body.action === 'upload') {
      var folder = DriveApp.getFolderById(FOLDER_ID);
      var blob = Utilities.newBlob(
        Utilities.base64Decode(body.data),
        body.mimeType || 'application/octet-stream',
        body.name || 'file'
      );
      var file = folder.createFile(blob);
      return out({ ok: true, id: file.getId(), url: file.getUrl() });
    }

    if (body.action === 'sheet') {
      if (!SHEET_ID) return out({ error: 'SHEET_ID is not set in the Apps Script.' });
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sh = ss.getSheetByName(body.tab) || ss.insertSheet(body.tab);
      sh.clear();
      var values = [body.header].concat(body.rows || []);
      sh.getRange(1, 1, values.length, values[0].length).setValues(values);
      return out({ ok: true, rows: (body.rows || []).length });
    }

    return out({ error: 'unknown action' });
  } catch (err) {
    return out({ error: String(err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ═══════════════════════════════════════════════════════════════════════════
//  B.  Social capture from Gmail
//
//  Instagram, LinkedIn, Facebook and X already email you when something
//  happens. This reads those emails and posts them to the CRM, which writes a
//  one-line summary and notifies the right people. No platform API, no
//  developer account, no cost.
// ═══════════════════════════════════════════════════════════════════════════

var SOCIAL_QUERY =
  'newer_than:2d (' +
  'from:mail.instagram.com OR from:instagram.com OR ' +
  'from:linkedin.com OR from:facebookmail.com OR ' +
  'from:x.com OR from:twitter.com OR from:youtube.com' +
  ') -label:crm-captured';

function scanSocialOnce() {
  if (INGEST_KEY.indexOf('PASTE') === 0) {
    Logger.log('INGEST_KEY is not filled in yet — stopping.');
    return;
  }

  var label = GmailApp.getUserLabelByName('crm-captured') || GmailApp.createLabel('crm-captured');
  var threads = GmailApp.search(SOCIAL_QUERY, 0, 25);
  var messages = [];

  for (var i = 0; i < threads.length; i++) {
    var msgs = threads[i].getMessages();
    for (var j = 0; j < msgs.length; j++) {
      var m = msgs[j];
      messages.push({
        messageId: m.getId(),
        from: m.getFrom(),
        subject: m.getSubject(),
        body: m.getPlainBody().substring(0, 4000)
      });
    }
  }

  if (!messages.length) { Logger.log('nothing new'); return; }

  var res = UrlFetchApp.fetch(CRM_URL + '/api/ingest/social-email', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-ingest-key': INGEST_KEY },
    payload: JSON.stringify({ messages: messages }),
    muteHttpExceptions: true
  });

  Logger.log(res.getResponseCode() + ' ' + res.getContentText());

  // Label only after the CRM accepts them, so a failure simply retries next hour.
  if (res.getResponseCode() === 200) {
    for (var k = 0; k < threads.length; k++) threads[k].addLabel(label);
  }
}


// ═══════════════════════════════════════════════════════════════════════════
//  C.  Hourly overdue reminders
//
//  Vercel's free plan allows only ONE scheduled job per day, so this does the
//  hourly run instead. Calling it more often than needed is harmless — the CRM
//  tracks per-item timing, so nobody is messaged twice.
// ═══════════════════════════════════════════════════════════════════════════

function pingEscalation() {
  if (CRON_KEY.indexOf('PASTE') === 0) {
    Logger.log('CRON_KEY is not filled in yet — stopping.');
    return;
  }

  var res = UrlFetchApp.fetch(CRM_URL + '/api/cron/escalate?key=' + encodeURIComponent(CRON_KEY), {
    method: 'get',
    muteHttpExceptions: true
  });

  Logger.log(res.getResponseCode() + ' ' + res.getContentText());
}


// ═══════════════════════════════════════════════════════════════════════════
//  D.  One-click check — run this after setup to confirm everything works.
// ═══════════════════════════════════════════════════════════════════════════

function testEverything() {
  var report = [];

  try {
    report.push('Drive folder: ' + DriveApp.getFolderById(FOLDER_ID).getName() + '  ✓');
  } catch (err) {
    report.push('Drive folder FAILED: ' + err);
  }

  try {
    report.push('Sheet: ' + SpreadsheetApp.openById(SHEET_ID).getName() + '  ✓');
  } catch (err) {
    report.push('Sheet FAILED: ' + err);
  }

  try {
    var a = UrlFetchApp.fetch(CRM_URL + '/api/cron/escalate?key=' + encodeURIComponent(CRON_KEY), { muteHttpExceptions: true });
    report.push('Escalation endpoint: HTTP ' + a.getResponseCode() +
                (a.getResponseCode() === 200 ? '  ✓' : '  ← 401 means CRON_KEY does not match Vercel'));
  } catch (err) {
    report.push('Escalation FAILED: ' + err);
  }

  try {
    var b = UrlFetchApp.fetch(CRM_URL + '/api/ingest/social-email', {
      method: 'post', contentType: 'application/json',
      headers: { 'x-ingest-key': INGEST_KEY },
      payload: JSON.stringify({ messages: [] }),
      muteHttpExceptions: true
    });
    report.push('Social endpoint: HTTP ' + b.getResponseCode() +
                (b.getResponseCode() === 200 ? '  ✓' : '  ← 401 means INGEST_KEY does not match Vercel'));
  } catch (err) {
    report.push('Social FAILED: ' + err);
  }

  Logger.log(report.join('\n'));
}

/* ══════════════════════════════════════════════════════════════════════════
 *  PROPERTY PORTAL LEADS  (v8.2)
 *  99acres, MagicBricks, Housing.com and the rest all email you the moment
 *  someone enquires. This reads those emails and turns them into CRM leads.
 *  Their partner APIs need a paid listing contract; these emails do not.
 *
 *  SETUP
 *   1. INGEST_KEY above must already be filled in.
 *   2. Run scanPortalsOnce() once and approve the permission.
 *   3. Triggers > Add Trigger > scanPortalsOnce > Time-driven >
 *      Minutes timer > Every 15 minutes. Portal leads go cold fast.
 * ═══════════════════════════════════════════════════════════════════════ */

var PORTAL_QUERY =
  'newer_than:2d (' +
  'from:99acres.com OR from:magicbricks.com OR from:housing.com OR ' +
  'from:proptiger.com OR from:commonfloor.com OR from:nobroker.in' +
  ') -label:crm-portal';

function scanPortalsOnce() {
  if (INGEST_KEY.indexOf('PASTE') === 0) {
    Logger.log('INGEST_KEY is not filled in yet — stopping.');
    return;
  }

  var label = GmailApp.getUserLabelByName('crm-portal') || GmailApp.createLabel('crm-portal');
  var threads = GmailApp.search(PORTAL_QUERY, 0, 30);
  var messages = [];

  for (var i = 0; i < threads.length; i++) {
    var msgs = threads[i].getMessages();
    for (var j = 0; j < msgs.length; j++) {
      messages.push({
        messageId: msgs[j].getId(),
        from: msgs[j].getFrom(),
        subject: msgs[j].getSubject(),
        body: msgs[j].getPlainBody().substring(0, 4000)
      });
    }
  }

  if (!messages.length) { Logger.log('no portal leads'); return; }

  var res = UrlFetchApp.fetch(CRM_URL + '/api/ingest/portal', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-ingest-key': INGEST_KEY },
    payload: JSON.stringify({ messages: messages }),
    muteHttpExceptions: true
  });

  Logger.log(res.getResponseCode() + ' ' + res.getContentText());

  if (res.getResponseCode() === 200) {
    for (var k = 0; k < threads.length; k++) threads[k].addLabel(label);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 *  TWO-WAY EMAIL  (v9.0)
 *  Reads the actual conversation with buyers — both what they send you and
 *  what you send them — and threads it onto the right lead in the CRM.
 *
 *  Uses the mailbox permission this script already has. No Cloud Console,
 *  no OAuth app, no API project, no cost.
 *
 *  SETUP
 *   1. INGEST_KEY above must already be filled in.
 *   2. Run scanMailOnce() once and approve the permission.
 *   3. Triggers > Add Trigger > scanMailOnce > Time-driven >
 *      Minutes timer > Every 15 minutes.
 *
 *  Anything from an address the CRM does not recognise is ignored — your
 *  personal mail is never stored.
 * ═══════════════════════════════════════════════════════════════════════ */

function scanMailOnce() {
  if (INGEST_KEY.indexOf('PASTE') === 0) {
    Logger.log('INGEST_KEY is not filled in yet — stopping.');
    return;
  }

  var me = Session.getActiveUser().getEmail().toLowerCase();
  var threads = GmailApp.search('newer_than:3d -in:chats -label:crm-mailed', 0, 40);
  var messages = [];

  for (var i = 0; i < threads.length; i++) {
    var msgs = threads[i].getMessages();
    for (var j = 0; j < msgs.length; j++) {
      var m = msgs[j];
      var from = m.getFrom().toLowerCase();
      var outbound = from.indexOf(me) !== -1;

      // Skip the machine mail we already capture elsewhere.
      if (/99acres|magicbricks|housing\.com|instagram|linkedin|facebookmail|no-?reply|notification/.test(from)) continue;

      messages.push({
        messageId: m.getId(),
        from: m.getFrom(),
        to: m.getTo(),
        subject: m.getSubject(),
        body: m.getPlainBody().substring(0, 8000),
        date: m.getDate().toISOString(),
        outbound: outbound
      });
    }
  }

  if (!messages.length) { Logger.log('no mail to sync'); return; }

  var res = UrlFetchApp.fetch(CRM_URL + '/api/ingest/email', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-ingest-key': INGEST_KEY },
    payload: JSON.stringify({ messages: messages }),
    muteHttpExceptions: true
  });

  Logger.log(res.getResponseCode() + ' ' + res.getContentText());

  if (res.getResponseCode() === 200) {
    var label = GmailApp.getUserLabelByName('crm-mailed') || GmailApp.createLabel('crm-mailed');
    for (var k = 0; k < threads.length; k++) threads[k].addLabel(label);
  }
}

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  AMEYA HEIGHTS CRM — Google connector
 *  v9.0 · everything below is already filled in. Paste and go.
 * ══════════════════════════════════════════════════════════════════════════
 *
 *  WHAT TO DO
 *   1. Select all in the editor (Cmd+A) and paste this over the top. Save.
 *   2. Run  testEverything  once. Approve the permissions Google asks for.
 *      You want five ticks in the Execution log.
 *   3. Left sidebar → clock icon (Triggers) → Add Trigger, four times:
 *
 *        pingEscalation    Time-driven   Hour timer      Every hour
 *        scanMailOnce      Time-driven   Minutes timer   Every 15 minutes
 *        scanPortalsOnce   Time-driven   Minutes timer   Every 15 minutes
 *        scanSocialOnce    Time-driven   Hour timer      Every hour
 *
 *      Set "Failure notification" to "Notify me immediately" on each.
 *   4. Deploy → Manage deployments → pencil → Version: NEW VERSION → Deploy.
 *      Editing the code alone does not update the live web app.
 *
 *  This runs as YOU. It uses your own 15GB Drive quota and your own mailbox
 *  permission. No Cloud Console, no API project, no billing, no card.
 */

// ── Settings — all filled in ────────────────────────────────────────────────
var SECRET     = '3b6b3f81ab2515276cbd09b6e15c2592464ae364';
var FOLDER_ID  = '1zkJogniKQSdLFksHIr0wQuCdECJoEQIy';
var SHEET_ID   = '1iO_jlkiX6Jhq8zWyhcRwcDDZDPpOEenQPv-WaFP5hmk';

var CRM_URL    = 'https://ameyacrm.vercel.app';
var CRON_KEY   = '71066c12b37ebc8b7c847648994e409f39c2ae25';
var INGEST_KEY = 'ab89b3bd3f28246e5c28f67d30ff0702b7732032';

// Your own address, used to tell outgoing mail from incoming.
var MY_EMAIL   = 'hi@ameyaheights.com';


/* ═══════════════════════════════════════════════════════════════════════════
 *  A.  Drive uploads and Sheets export — called by the CRM
 * ═══════════════════════════════════════════════════════════════════════════ */

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


/* ═══════════════════════════════════════════════════════════════════════════
 *  Shared helpers
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Gmail search window since this scanner last ran.
 *
 * Earlier versions labelled threads and excluded them next time. That quietly
 * broke replies: once a thread carried the label, every later message in it was
 * skipped. The CRM already ignores any message id it has seen, so scanning by
 * time and letting the server deduplicate is both simpler and correct.
 */
function windowFor(key, fallbackDays) {
  var props = PropertiesService.getScriptProperties();
  var last = props.getProperty(key);
  if (!last) return 'newer_than:' + fallbackDays + 'd';
  return 'after:' + last;
}

function markScanned(key) {
  // Rewind five minutes so a message arriving mid-run is never missed.
  var stamp = Math.floor(Date.now() / 1000) - 300;
  PropertiesService.getScriptProperties().setProperty(key, String(stamp));
}

function postJson(path, payload) {
  return UrlFetchApp.fetch(CRM_URL + path, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-ingest-key': INGEST_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

function myAddress() {
  var a = '';
  try { a = Session.getActiveUser().getEmail() || ''; } catch (err) { a = ''; }
  return (a || MY_EMAIL).toLowerCase();
}


/* ═══════════════════════════════════════════════════════════════════════════
 *  B.  Hourly overdue reminders
 *
 *  Vercel's free plan allows one scheduled job a day, so this does the hourly
 *  run instead. Calling it more often than needed is harmless — the CRM keeps
 *  the per-item timing, so nobody is messaged twice.
 * ═══════════════════════════════════════════════════════════════════════════ */

function pingEscalation() {
  var res = UrlFetchApp.fetch(
    CRM_URL + '/api/cron/escalate?key=' + encodeURIComponent(CRON_KEY),
    { method: 'get', muteHttpExceptions: true }
  );
  Logger.log(res.getResponseCode() + ' ' + res.getContentText());
}


/* ═══════════════════════════════════════════════════════════════════════════
 *  C.  Two-way email — the conversation with buyers
 *
 *  Reads what they send you and what you send them, and threads it onto the
 *  right lead. Anything from an address the CRM does not recognise is thrown
 *  away by the server — your personal mail is never stored.
 * ═══════════════════════════════════════════════════════════════════════════ */

var MACHINE_SENDERS = /99acres|magicbricks|housing\.com|proptiger|commonfloor|nobroker|instagram|linkedin|facebookmail|twitter\.com|x\.com|youtube|no-?reply|noreply|notification|mailer-daemon|calendar-notification/i;

function scanMailOnce() {
  var me = myAddress();
  var query = windowFor('lastMailScan', 3) + ' -in:chats -in:spam -in:trash';
  var threads = GmailApp.search(query, 0, 50);
  var messages = [];

  for (var i = 0; i < threads.length; i++) {
    var msgs = threads[i].getMessages();
    for (var j = 0; j < msgs.length; j++) {
      var m = msgs[j];
      var from = m.getFrom().toLowerCase();
      if (MACHINE_SENDERS.test(from)) continue;

      messages.push({
        messageId: m.getId(),
        from: m.getFrom(),
        to: m.getTo(),
        subject: m.getSubject(),
        body: m.getPlainBody().substring(0, 8000),
        date: m.getDate().toISOString(),
        outbound: from.indexOf(me) !== -1
      });
    }
  }

  if (!messages.length) { Logger.log('mail: nothing new'); return; }

  var res = postJson('/api/ingest/email', { messages: messages });
  Logger.log('mail ' + res.getResponseCode() + ' ' + res.getContentText());
  if (res.getResponseCode() === 200) markScanned('lastMailScan');
}


/* ═══════════════════════════════════════════════════════════════════════════
 *  D.  Property portal leads
 *
 *  99acres, MagicBricks, Housing and the rest email you the moment somebody
 *  enquires. Their partner APIs need a paid listing contract; these emails
 *  need nothing.
 * ═══════════════════════════════════════════════════════════════════════════ */

function scanPortalsOnce() {
  var query = windowFor('lastPortalScan', 2) +
    ' (from:99acres.com OR from:magicbricks.com OR from:housing.com OR ' +
    'from:proptiger.com OR from:commonfloor.com OR from:nobroker.in)';
  var threads = GmailApp.search(query, 0, 40);
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

  if (!messages.length) { Logger.log('portals: nothing new'); return; }

  var res = postJson('/api/ingest/portal', { messages: messages });
  Logger.log('portals ' + res.getResponseCode() + ' ' + res.getContentText());
  if (res.getResponseCode() === 200) markScanned('lastPortalScan');
}


/* ═══════════════════════════════════════════════════════════════════════════
 *  E.  Social activity
 *
 *  Instagram, LinkedIn, Facebook and X already email you when something
 *  happens. The CRM summarises each one in a line and notifies the right
 *  people. No platform API, no developer account.
 * ═══════════════════════════════════════════════════════════════════════════ */

function scanSocialOnce() {
  var query = windowFor('lastSocialScan', 2) +
    ' (from:mail.instagram.com OR from:instagram.com OR from:linkedin.com OR ' +
    'from:facebookmail.com OR from:x.com OR from:twitter.com OR from:youtube.com)';
  var threads = GmailApp.search(query, 0, 30);
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

  if (!messages.length) { Logger.log('social: nothing new'); return; }

  var res = postJson('/api/ingest/social-email', { messages: messages });
  Logger.log('social ' + res.getResponseCode() + ' ' + res.getContentText());
  if (res.getResponseCode() === 200) markScanned('lastSocialScan');
}


/* ═══════════════════════════════════════════════════════════════════════════
 *  F.  Run this after pasting. Five ticks means everything works.
 * ═══════════════════════════════════════════════════════════════════════════ */

function testEverything() {
  var report = ['Signed in as: ' + myAddress(), ''];

  try {
    report.push('Drive folder: ' + DriveApp.getFolderById(FOLDER_ID).getName() + '   OK');
  } catch (err) { report.push('Drive folder FAILED: ' + err); }

  try {
    report.push('Sheet: ' + SpreadsheetApp.openById(SHEET_ID).getName() + '   OK');
  } catch (err) { report.push('Sheet FAILED: ' + err); }

  try {
    var a = UrlFetchApp.fetch(CRM_URL + '/api/cron/escalate?key=' + encodeURIComponent(CRON_KEY), { muteHttpExceptions: true });
    report.push('Reminders endpoint: HTTP ' + a.getResponseCode() +
      (a.getResponseCode() === 200 ? '   OK' : '   <- 401 means CRON_KEY does not match Vercel'));
  } catch (err) { report.push('Reminders FAILED: ' + err); }

  try {
    var b = postJson('/api/ingest/email', { messages: [] });
    report.push('Email endpoint: HTTP ' + b.getResponseCode() +
      (b.getResponseCode() === 200 ? '   OK' : '   <- 401 means INGEST_KEY does not match Vercel'));
  } catch (err) { report.push('Email FAILED: ' + err); }

  try {
    var c = postJson('/api/ingest/portal', { messages: [] });
    report.push('Portal endpoint: HTTP ' + c.getResponseCode() +
      (c.getResponseCode() === 200 ? '   OK' : '   <- check INGEST_KEY'));
  } catch (err) { report.push('Portal FAILED: ' + err); }

  try {
    var d = postJson('/api/ingest/social-email', { messages: [] });
    report.push('Social endpoint: HTTP ' + d.getResponseCode() +
      (d.getResponseCode() === 200 ? '   OK' : '   <- check INGEST_KEY'));
  } catch (err) { report.push('Social FAILED: ' + err); }

  try {
    report.push('', 'Mailbox reachable: ' + GmailApp.search('newer_than:1d', 0, 1).length + ' recent thread(s) visible');
  } catch (err) { report.push('Gmail permission FAILED: ' + err); }

  Logger.log(report.join('\n'));
}

/** Forget the scan history and re-read the last few days. Safe — the CRM ignores duplicates. */
function resetScanHistory() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('lastMailScan');
  props.deleteProperty('lastPortalScan');
  props.deleteProperty('lastSocialScan');
  Logger.log('Scan history cleared. The next run will re-read the last few days.');
}

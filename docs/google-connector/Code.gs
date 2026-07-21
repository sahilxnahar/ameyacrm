/**
 * SECURITY — read before editing.
 *
 * The three keys below are blank on purpose. This file is committed to the
 * repository, so a real key written here is a key published to anyone who can
 * read the repo. Paste the real values into the Apps Script editor only; they
 * live in that project, never in git.
 */
/**
 * ══════════════════════════════════════════════════════════════════════════
 *  AMEYA HEIGHTS CRM — Google connector
 *  v9.1 · one-click setup. Everything is filled in already.
 * ══════════════════════════════════════════════════════════════════════════
 *
 *  ALL YOU DO:
 *
 *   1. Paste this whole file over whatever is in the editor. Save (Cmd+S).
 *   2. Choose  setupEverything  in the function dropdown at the top.
 *   3. Press Run. Approve the permissions Google asks for.
 *   4. Read the Execution log. It creates all four triggers, tests every
 *      connection, and tells you if anything is left to do.
 *
 *   That is it. Running it again is safe — it clears the old triggers first,
 *   so you never end up with duplicates.
 *
 *  ONE THING THE SCRIPT CANNOT DO FOR ITSELF:
 *   Publishing the web app. If Drive uploads or Sheets export are not working,
 *   do this once: Deploy → New deployment → type "Web app" →
 *   Execute as: Me · Who has access: Anyone → Deploy → copy the /exec URL →
 *   paste it into Vercel as GAS_WEBAPP_URL → Create Deployment.
 *
 *  This runs as whoever owns this project. Best owned by hi@ameyaheights.com
 *  rather than a person, so it survives someone leaving.
 */

// ── Settings — all filled in ────────────────────────────────────────────────
var SECRET     = 'PASTE_GAS_SECRET_HERE';     // must match GAS_SECRET in Vercel
var FOLDER_ID  = '1zkJogniKQSdLFksHIr0wQuCdECJoEQIy';
var SHEET_ID   = '1iO_jlkiX6Jhq8zWyhcRwcDDZDPpOEenQPv-WaFP5hmk';

var CRM_URL    = 'https://crm.ameyaheights.com';
var CRON_KEY   = 'PASTE_CRON_SECRET_HERE';    // must match CRON_SECRET in Vercel
var INGEST_KEY = 'PASTE_INGEST_SECRET_HERE';  // must match INGEST_SECRET in Vercel

// Every address that counts as "us", so replies and sent mail are told apart
// correctly. The script reads the mailbox of whoever owns it (Sahil), but the
// CRM sends as crm@ via hi@ — all three must be recognised.
var MY_ADDRESSES = ['sahil@ameyaheights.com', 'hi@ameyaheights.com', 'crm@ameyaheights.com'];


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
      var folder = resolvePath(body.folderPath);
      var blob = Utilities.newBlob(
        Utilities.base64Decode(body.data),
        body.mimeType || 'application/octet-stream',
        body.name || 'file'
      );
      var file = folder.createFile(blob);
      return out({ ok: true, id: file.getId(), url: file.getUrl(), folderId: folder.getId() });
    }

    if (body.action === 'folder') {
      var f = resolvePath(body.folderPath);
      return out({ ok: true, id: f.getId(), name: f.getName() });
    }

    if (body.action === 'list') {
      var root = resolvePath(body.folderPath);
      var found = [];
      collect(root, [], found, 0);
      return out({ ok: true, files: found });
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

/**
 * Walk (and create) a folder path inside the connected Drive folder, so the
 * CRM's folder tree is mirrored rather than everything landing in one heap.
 */
function resolvePath(path) {
  var folder = DriveApp.getFolderById(FOLDER_ID);
  if (!path || !path.length) return folder;
  for (var i = 0; i < Math.min(path.length, 8); i++) {
    var name = String(path[i]).trim();
    if (!name || name === '.' || name === '..') continue;
    var it = folder.getFoldersByName(name);
    folder = it.hasNext() ? it.next() : folder.createFolder(name);
  }
  return folder;
}

/** Everything under a folder, with the path each file sits at. */
function collect(folder, path, out_, depth) {
  if (depth > 6 || out_.length > 400) return;
  var files = folder.getFiles();
  while (files.hasNext() && out_.length <= 400) {
    var f = files.next();
    out_.push({
      id: f.getId(), name: f.getName(), mimeType: f.getMimeType(),
      size: f.getSize(), url: f.getUrl(), path: path
    });
  }
  var subs = folder.getFolders();
  while (subs.hasNext()) {
    var sf = subs.next();
    collect(sf, path.concat([sf.getName()]), out_, depth + 1);
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
  return (a || MY_ADDRESSES[0]).toLowerCase();
}

/** True when a message came from us rather than from a buyer. */
function isOurs(from) {
  var f = String(from).toLowerCase();
  if (f.indexOf(myAddress()) !== -1) return true;
  for (var i = 0; i < MY_ADDRESSES.length; i++) {
    if (f.indexOf(MY_ADDRESSES[i].toLowerCase()) !== -1) return true;
  }
  return false;
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
        outbound: isOurs(from)
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
 *  SETUP — run this one function and everything else happens by itself.
 * ═══════════════════════════════════════════════════════════════════════════ */

var TRIGGER_PLAN = [
  { fn: 'pingEscalation',  every: 'hours',   n: 1,  what: 'Overdue reminders, hourly' },
  { fn: 'scanMailOnce',    every: 'minutes', n: 15, what: 'Buyer emails, every 15 minutes' },
  { fn: 'scanPortalsOnce', every: 'minutes', n: 15, what: 'Portal leads, every 15 minutes' },
  { fn: 'scanSocialOnce',  every: 'hours',   n: 1,  what: 'Social activity, hourly' },
  { fn: 'scanDriveOnce',   every: 'minutes', n: 15, what: 'Files added straight to Drive, every 15 minutes' }
];

function setupEverything() {
  var log = [];
  log.push('AMEYA HEIGHTS CRM — CONNECTOR SETUP');
  log.push('Account: ' + myAddress());
  log.push('CRM:     ' + CRM_URL);
  log.push('');

  // 1. Clear any triggers already here, so running this twice is harmless.
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) ScriptApp.deleteTrigger(existing[i]);
  log.push('Removed ' + existing.length + ' old trigger(s).');

  // 2. Create the four we need.
  for (var j = 0; j < TRIGGER_PLAN.length; j++) {
    var t = TRIGGER_PLAN[j];
    try {
      var b = ScriptApp.newTrigger(t.fn).timeBased();
      if (t.every === 'hours') b.everyHours(t.n); else b.everyMinutes(t.n);
      b.create();
      log.push('  created  ' + t.fn + '  —  ' + t.what);
    } catch (err) {
      log.push('  FAILED   ' + t.fn + '  —  ' + err);
    }
  }
  log.push('');

  // 3. Check every connection.
  log.push('CONNECTIONS');
  log.push(checkOne('Drive folder', function () { return DriveApp.getFolderById(FOLDER_ID).getName(); }));
  log.push(checkOne('Sheet', function () { return SpreadsheetApp.openById(SHEET_ID).getName(); }));
  log.push(checkHttp('Reminders', CRM_URL + '/api/cron/escalate?key=' + encodeURIComponent(CRON_KEY)));
  log.push(checkPost('Buyer email', '/api/ingest/email'));
  log.push(checkPost('Portal leads', '/api/ingest/portal'));
  log.push(checkPost('Social', '/api/ingest/social-email'));
  log.push(checkPost('Drive import', '/api/ingest/drive'));
  log.push(checkOne('Mailbox', function () {
    return GmailApp.search('newer_than:1d', 0, 1).length + ' recent thread(s) readable';
  }));
  log.push('');

  // 4. Say what is left.
  log.push('WHAT IS LEFT FOR YOU');
  log.push('  · Deploy → New deployment → Web app (Execute as: Me, Access: Anyone),');
  log.push('    then paste the /exec URL into Vercel as GAS_WEBAPP_URL.');
  log.push('    Skip this if Drive and Sheets already work.');
  log.push('  · Optional: Triggers page → each trigger → set failure notification');
  log.push('    to "Notify me immediately". Google does not allow that to be set here.');
  log.push('');
  log.push('Anything above marked FAILED needs attention. Everything else is running.');

  Logger.log(log.join('\n'));
}

function checkOne(label, fn) {
  try { return '  ok       ' + label + ': ' + fn(); }
  catch (err) { return '  FAILED   ' + label + ': ' + err; }
}

function checkHttp(label, url) {
  try {
    var code = UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getResponseCode();
    return (code === 200 ? '  ok       ' : '  FAILED   ') + label + ': HTTP ' + code +
      (code === 401 ? '  (CRON_KEY does not match Vercel)' : '');
  } catch (err) { return '  FAILED   ' + label + ': ' + err; }
}

function checkPost(label, path) {
  try {
    // The Drive route expects files, the mail routes expect messages. Send both
    // so one probe works for every endpoint.
    var code = postJson(path, { messages: [], files: [] }).getResponseCode();
    return (code === 200 ? '  ok       ' : '  FAILED   ') + label + ': HTTP ' + code +
      (code === 401 ? '  (INGEST_KEY does not match Vercel)' : '');
  } catch (err) { return '  FAILED   ' + label + ': ' + err; }
}

/** What is currently scheduled. Run any time to check. */
function showTriggers() {
  var t = ScriptApp.getProjectTriggers();
  var out = ['Scheduled jobs on this project: ' + t.length, ''];
  for (var i = 0; i < t.length; i++) out.push('  ' + t[i].getHandlerFunction());
  if (!t.length) out.push('  none — run setupEverything');
  Logger.log(out.join('\n'));
}

/** Turn everything off. Use on the OLD project after moving to a new account. */
function removeAllTriggers() {
  var t = ScriptApp.getProjectTriggers();
  for (var i = 0; i < t.length; i++) ScriptApp.deleteTrigger(t[i]);
  Logger.log('Removed ' + t.length + ' trigger(s). Nothing is scheduled on this project any more.');
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

/* ══════════════════════════════════════════════════════════════════════════
 *  G.  DRIVE → CRM  (v9.6)
 *
 *  The other direction. Anything you drop straight into the Drive folder —
 *  including whole folders dragged from your desktop — becomes a document in
 *  the CRM, in a matching folder tree, visible to everyone with access.
 *
 *  Files the CRM itself put in Drive are recognised and skipped, so nothing
 *  bounces back and forth.
 *
 *  Added automatically by setupEverything. To add it by hand:
 *    Triggers > Add Trigger > scanDriveOnce > Time-driven >
 *    Minutes timer > Every 15 minutes.
 * ═══════════════════════════════════════════════════════════════════════ */

function scanDriveOnce() {
  if (INGEST_KEY.indexOf('PASTE') === 0) {
    Logger.log('INGEST_KEY is not filled in yet — stopping.');
    return;
  }

  var root = DriveApp.getFolderById(FOLDER_ID);
  var found = [];
  collect(root, [], found, 0);

  if (!found.length) { Logger.log('drive: nothing in the folder'); return; }

  var res = postJson('/api/ingest/drive', { files: found });
  Logger.log('drive ' + res.getResponseCode() + ' ' + res.getContentText());
}

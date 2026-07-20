/**
 * Ameya Heights CRM — Google connector (personal account, no Cloud Console, no billing).
 *
 * SETUP (5 minutes):
 *  1. Go to script.google.com  →  New project  →  delete the sample code  →  paste this file.
 *  2. Fill in FOLDER_ID (and SHEET_ID if you want Sheets export) below.
 *  3. Deploy  →  New deployment  →  type "Web app"
 *        Execute as:      Me  (your own Google account)
 *        Who has access:  Anyone
 *     →  Deploy  →  Authorize  →  copy the /exec URL.
 *  4. In Vercel add:  GAS_WEBAPP_URL = that URL       GAS_SECRET = the value below.
 *
 * Files are created BY YOU, so they use your own 15GB Drive quota. No service account,
 * no API keys, no payment method.
 */
var SECRET    = '3b6b3f81ab2515276cbd09b6e15c2592464ae364';
var FOLDER_ID = 'PASTE_YOUR_DRIVE_FOLDER_ID';   // from drive.google.com/drive/folders/<THIS_ID>
var SHEET_ID  = '';                              // optional: from docs.google.com/spreadsheets/d/<THIS_ID>/edit

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


/* ══════════════════════════════════════════════════════════════════════════
 *  SOCIAL SCANNER  (v7.0)
 *  Reads the notification emails Instagram / LinkedIn / Facebook / X already
 *  send you and posts them to the CRM. No platform API, no developer account.
 *
 *  SETUP
 *   1. Fill CRM_URL and INGEST_KEY below.
 *   2. Run scanSocialOnce() manually once and approve the Gmail permission.
 *   3. Triggers (clock icon) > Add Trigger > scanSocialOnce > Time-driven >
 *      Hour timer > Every hour.
 * ═══════════════════════════════════════════════════════════════════════ */

var CRM_URL    = 'https://ameyacrm.vercel.app';   // no trailing slash
var INGEST_KEY = 'PASTE_YOUR_INGEST_SECRET_HERE';

var SOCIAL_QUERY =
  'newer_than:2d (' +
  'from:mail.instagram.com OR from:instagram.com OR ' +
  'from:linkedin.com OR from:facebookmail.com OR ' +
  'from:x.com OR from:twitter.com OR from:youtube.com' +
  ') -label:crm-captured';

function scanSocialOnce() {
  var label = GmailApp.getUserLabelByName('crm-captured') || GmailApp.createLabel('crm-captured');
  var threads = GmailApp.search(SOCIAL_QUERY, 0, 25);
  var messages = [];
  var handled = [];

  for (var i = 0; i < threads.length; i++) {
    var msgs = threads[i].getMessages();
    for (var j = 0; j < msgs.length; j++) {
      var m = msgs[j];
      messages.push({
        messageId: m.getId(),
        from: m.getFrom(),
        subject: m.getSubject(),
        body: m.getPlainBody().slice(0, 4000)
      });
    }
    handled.push(threads[i]);
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

  // Only label once the CRM has accepted them, so a failure retries next hour.
  if (res.getResponseCode() === 200) {
    for (var k = 0; k < handled.length; k++) handled[k].addLabel(label);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 *  HOURLY OVERDUE ESCALATION  (v7.2)
 *  Vercel's free plan only allows one scheduled job per day, so this script
 *  does the hourly run instead. Costs nothing.
 *
 *  SETUP
 *   1. Fill CRON_KEY below with the CRON_SECRET from your Vercel settings.
 *   2. Run pingEscalation() once and approve the permission.
 *   3. Triggers (clock icon) > Add Trigger > pingEscalation >
 *      Time-driven > Hour timer > Every hour.
 * ═══════════════════════════════════════════════════════════════════════ */

var CRON_KEY = 'PASTE_YOUR_CRON_SECRET_HERE';

function pingEscalation() {
  var res = UrlFetchApp.fetch(CRM_URL + '/api/cron/escalate?key=' + encodeURIComponent(CRON_KEY), {
    method: 'get',
    muteHttpExceptions: true
  });
  Logger.log(res.getResponseCode() + ' ' + res.getContentText());
}

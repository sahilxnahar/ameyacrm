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

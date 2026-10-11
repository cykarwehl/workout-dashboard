// Manual workout logging endpoint for the dashboard's Log page.
//
// Setup (once):
//  1. Sheet → Extensions → Apps Script → add a new file, paste this in.
//     (If the project already has a doPost, merge instead of adding a second one.)
//  2. Project Settings → Script Properties → add LOG_TOKEN = <a passcode you choose>.
//  3. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
//     Copy the /exec URL into LOG_URL in index.html.
//  After editing this file later: Deploy → Manage deployments → edit → New version,
//  so the same URL keeps working.
//
// The URL is public, so every request must carry the passcode. It lives only in
// Script Properties and on your phone, never in git.

const LOG_SHEET_ID = '1l3J7Jedab0h9viwceYc8TQYp1yhylvOIkT_-Q_-L4pw';
const LOG_SHEET_NAME = 'Sheet1';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    const expected = PropertiesService.getScriptProperties().getProperty('LOG_TOKEN');
    if (!expected || body.token !== expected) return logJson({ ok: false, error: 'Wrong passcode' });

    const date = String(body.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return logJson({ ok: false, error: 'Invalid date' });

    const exercise = String(body.exercise || '').trim().slice(0, 60);
    if (!exercise) return logJson({ ok: false, error: 'Missing exercise' });

    const sets = Array.isArray(body.sets) ? body.sets : [];
    if (!sets.length || sets.length > 20) return logJson({ ok: false, error: 'Expected 1–20 sets' });

    // Same columns the screenshot importer writes:
    // Date | Machine | Set Number | Reps | Weight (kg) | Mode | Is PR? | Image Filename
    // Mode stays blank (free weights have none); "manual" marks rows typed in by hand.
    const rows = sets.map((s, i) => {
      const reps = Math.round(Number(s.reps));
      const weight = Number(s.weight) || 0;
      if (!(reps > 0 && reps < 500)) throw new Error(`Set ${i + 1}: invalid reps`);
      if (!(weight >= 0 && weight < 1000)) throw new Error(`Set ${i + 1}: invalid weight`);
      return [date, exercise, i + 1, reps, weight, '', '', 'manual'];
    });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = SpreadsheetApp.openById(LOG_SHEET_ID).getSheetByName(LOG_SHEET_NAME);
      const start = sheet.getLastRow() + 1;
      // Store the date as plain text so it reads back as YYYY-MM-DD like existing rows.
      sheet.getRange(start, 1, rows.length, 1).setNumberFormat('@');
      sheet.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
    } finally {
      lock.releaseLock();
    }

    return logJson({ ok: true, added: rows.length });
  } catch (err) {
    return logJson({ ok: false, error: err.message });
  }
}

function logJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

# Workout Dashboard — Flow & Security Notes

Written 2026-08-15. Read this before touching the project again after a long gap.

## Flow

1. **Screenshot upload → Apps Script** (not in this repo). A separate Google
   Apps Script project, bound to the spreadsheet, receives a workout
   screenshot and calls the **Gemini API** to parse/OCR it into structured
   rows, then appends them to the sheet. That script's source lives on
   script.google.com (Sheet → Extensions → Apps Script), not in git.
2. **Spreadsheet** — `SHEET_ID` in [index.html](index.html) — is the single
   source of truth for workout data.
3. **This repo (`index.html`)** is only the read-only dashboard. On load it
   calls the Google Sheets REST API directly from the browser
   (`index.html:143-149`) with a hardcoded API key, then renders Overview /
   PRs / charts client-side. No build step, no backend — plain static HTML.

## Security posture (checked 2026-08-15)

**Two Google Cloud API keys exist:**

- **Sheets API key** (hardcoded in `index.html`, used for the client-side
  read) — restricted to the Sheets API only, and to HTTP referrers
  `localhost:3000/*`, `localhost:8080/*`, `https://cykarwehl.github.io/*`.
  Low risk even though it's exposed in the public repo's git history,
  because of these restrictions.
  - **If deploying anywhere other than GitHub Pages/those localhost ports,
    add the new domain to this key's referrer allowlist first** or fetches
    will fail with a referrer-blocked error.
- **Gemini API key** — lives in the Apps Script project's Script Properties
  (Project Settings), never sent to the browser. Currently has **no API
  restriction** — recommended to add one limiting it to the Generative
  Language API, as cheap defense-in-depth. Not urgent since it's not
  exposed via this repo or the client.

**Repo is public on GitHub.** The Sheets API key and Spreadsheet ID are
committed in git history (multiple commits) — removing the line in a new
commit would NOT remove it from history; only rotating the key would. Not
rotated as of this writing because the referrer restriction already limits
blast radius to an acceptable level.

**Spreadsheet sharing: "Anyone with the link" = Viewer.** This is required
for the dashboard's API-key read to work, and is also what keeps the Apps
Script project (and the Gemini key inside it) private — only Editors of the
sheet can open Extensions → Apps Script; link-viewers cannot. Confirmed
2026-08-15. If this is ever changed to Editor, the Gemini key becomes
readable by anyone with the link.

**Bottom line:** current setup is reasonably safe as long as (a) the Sheets
key restrictions aren't loosened, (b) sheet sharing stays at Viewer not
Editor, and (c) the Gemini key gets an API restriction added at some point.

## Deploy

No build step needed — it's static HTML/JS.

- **GitHub Pages** was the working plan (Sheets key already allows
  `cykarwehl.github.io` as a referrer) — Settings → Pages → deploy from
  `main`. No key changes needed.
- **Netlify** was considered but not required; would need the Netlify
  domain added to the Sheets key's referrer allowlist first.

## Local dev

`sw.js` (service worker) won't register from `file://`. Serve it instead:

```
python3 -m http.server 8000
```

then open `http://localhost:8000`. (Note: 8000 isn't in the current
referrer allowlist — use `localhost:3000` or `localhost:8080`, or add 8000
to the Sheets key if you want to keep using it.)

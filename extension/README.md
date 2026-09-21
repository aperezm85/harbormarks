# HarborMarks Quick Save — Browser Extension (Chrome / Edge)

One-click save of the current tab to your self-hosted HarborMarks library.
No build step: plain Manifest V3 HTML/CSS/JS, load unpacked.

## Layout

```text
extension/
├── manifest.json          # MV3: popup, options page, service worker
├── background.js          # Right-click "Save to HarborMarks" → /save page (session flow)
├── popup/                 # Toolbar popup: Bearer-key save form
├── settings/              # Options page: instance URL + API key + test button
└── icons/                 # Committed 16/48/128 PNGs (white tile + anchor mark)
```

Two save paths, same as the rest of quick-save:

| Path | Auth | Needs |
| --- | --- | --- |
| Popup form | `Authorization: Bearer <API key>` → `POST /api/bookmarks` | API key from Profile → API keys |
| Right-click menu / "Open quick-save page" | Login session → `/save?url=…` | Logged in, no key |

## Setup

1. Create an API key: HarborMarks **Profile → API keys** → name it (e.g.
   `laptop-chrome`) → copy the `hm_…` value (shown once).
2. Allow the extension origin server-side (popup `fetch` is cross-origin):
   set `HARBOR_CORS_ORIGINS` to your extension ID URL. After loading
   unpacked once, `chrome://extensions` shows the ID; the origin is
   `chrome-extension://<id>`. Example:

   ```yaml
   HARBOR_CORS_ORIGINS: chrome-extension://abcdefghijklmnopqrstuvwxyz123456
   ```

   Restart the app container after changing it.
3. Load unpacked: `chrome://extensions` → Developer mode → Load unpacked →
   select this `extension/` folder.
4. Click the toolbar icon → Settings → paste the instance URL
   (`https://YOUR-HOST`, no trailing path) and the API key → **Test
   connection** (read-only `GET /api/bookmarks?pageSize=1`; also proves
   CORS is right).

## Behavior notes

- Popup prefills title from the tab and description from the page's
  `<meta name="description">` / `og:description` (best-effort; empty on
  `chrome://`, Web Store, and other script-blocked pages).
- Re-saving a URL reports `Already saved: <title>` (the API's
  `duplicate_bookmark` 409) instead of erroring.
- A `TypeError` on save almost always means: wrong instance URL, offline
  host, or the extension origin missing from `HARBOR_CORS_ORIGINS`.
- Keys can't manage keys: use the Profile page (session) to create/revoke.

## Regenerating icons

`icons/*.png` are rasterized from `../src/assets/harborMark.svg` (white
rounded tile + anchor, padding 16%). Any SVG→PNG export at 16/48/128 with
the same framing works — e.g. with `sharp`:

```js
// 128px example
await sharp(Buffer.from(svg))
  .resize(88, 88, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
// composite centered on a 128px white rounded-rect tile, save as icon128.png
```

# Browser Extension — Implementation Plan

## Overview

Chrome/Edge extension to quick-save the current tab's URL to HarborMarks with one click. Uses API key authentication.

---

## Phase 1: HarborMarks Backend Changes

### 1. API Key Support

**New DB table** — `migrations/0010_api_keys.sql`:
```sql
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
```

**New files:**
- `src/lib/api-key.ts` — `generateApiKey()`, `hashApiKey()`, `verifyApiKey()`, `createApiKey()`, `revokeApiKey()`, `listApiKeysByUser()`, `recordApiKeyUse()`
- `src/lib/auth.ts` — New `getApiUser(request)` function that checks `Authorization: Bearer <key>` header, looks up key hash, resolves to user, returns same partial user object as `getSessionUser()`
- `src/middleware.ts` — Add `getAuthUser(request)` that tries session auth first, falls back to API key auth, injects into `Astro.locals`

**API endpoints:**
- `GET /api/admin/api-keys` — List API keys for current user
- `POST /api/admin/api-keys` — Create new API key (returns key once, then only hash)
- `DELETE /api/admin/api-keys/[id]` — Revoke an API key

**Existing routes to update:**
- `src/pages/api/bookmarks/index.ts` — Accept `Authorization: Bearer` header as alternative to session cookie
- `src/pages/api/bookmarks/[id].ts` — Same
- `src/pages/api/bookmarks/tags.ts` — Same

### 2. CORS Support

**Middleware changes** (`src/middleware.ts`):
- Read configured `CORS_ORIGINS` from env (comma-separated list of instance URLs)
- For API routes, add headers:
  - `Access-Control-Allow-Origin: <matching origin>`
  - `Access-Control-Allow-Credentials: true`
  - `Access-Control-Allow-Headers: Authorization, Content-Type`
  - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- Handle `OPTIONS` preflight requests (return 204)

---

## Phase 2: Browser Extension

### File Structure

```
extension/
├── manifest.json
├── background.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── settings/
│   ├── settings.html
│   ├── settings.css
│   └── settings.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Extension Files

**`manifest.json`** — Manifest V3
- Permissions: `cookies`, `storage`, `tabs`
- `host_permissions: ["<all_urls>"]`
- Action popup: `popup/popup.html`
- Options page: `settings/settings.html`

**`background.js`** — Service worker
- Listen for `chrome.action.onClicked`
- Read `harbormarksUrl` + `apiKey` from `chrome.storage.sync`
- Inject content script into active tab to get page title and description
- Call `POST <harbormarksUrl>/api/bookmarks` with `Authorization: Bearer <apiKey>`
- Handle CORS preflight for custom origins

**`popup/popup.html`** — Compact save form
- URL display (readonly)
- Title (editable, pre-filled from page)
- Tags input (comma-separated)
- Note textarea
- Favorite toggle
- Save button
- Success/error toast

**`popup/popup.css`** — Dark theme matching HarborMarks

**`popup/popup.js`** — On popup open:
1. Read `harbormarksUrl` + `apiKey` from `chrome.storage.sync`
2. Inject content script into active tab
3. Get page title, description, favicon
4. Pre-fill form fields
5. On save: POST to API, show toast result

**`settings/settings.html`** — Configuration page
- HarborMarks instance URL input
- API key input
- Save button
- Instructions for generating API key from profile page

**`settings/settings.js`** — Store config in `chrome.storage.sync`

**`icons/`** — SVG-based icons exported to 16/48/128px PNG

### Extension Flow

1. User opens extension → popup loads
2. Extension reads `harbormarksUrl` + `apiKey` from `chrome.storage.sync`
3. Injects content script into current tab to get `<title>` and `<meta name="description">`
4. Pre-fills popup form with title, description
5. User edits tags/note, clicks save
6. Extension sends `POST <harbormarksUrl>/api/bookmarks` with `{url, title, tags, note, isFavorite}` + `Authorization: Bearer <apiKey>`
7. Shows success/error toast in popup

---

## Implementation Checklist

### Backend
- [ ] Create `migrations/0010_api_keys.sql`
- [ ] Add `apiKeys` table to `src/db/schema.ts`
- [ ] Create `src/lib/api-key.ts` utility functions
- [ ] Add `getApiUser()` to `src/lib/auth.ts`
- [ ] Add `getAuthUser()` to `src/middleware.ts`
- [ ] Add CORS headers to middleware
- [ ] Create `src/pages/api/admin/api-keys.ts` endpoint
- [ ] Update `src/pages/api/bookmarks/index.ts` to accept API key auth
- [ ] Update `src/pages/api/bookmarks/[id].ts` to accept API key auth
- [ ] Update `src/pages/api/bookmarks/tags.ts` to accept API key auth
- [ ] Add API keys section to `src/pages/profile.astro`

### Extension
- [ ] Create `extension/manifest.json`
- [ ] Create `extension/background.js`
- [ ] Create `extension/popup/popup.html`
- [ ] Create `extension/popup/popup.css`
- [ ] Create `extension/popup/popup.js`
- [ ] Create `extension/settings/settings.html`
- [ ] Create `extension/settings/settings.css`
- [ ] Create `extension/settings/settings.js`
- [ ] Create `extension/icons/` (16/48/128px)

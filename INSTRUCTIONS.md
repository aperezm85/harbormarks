# HarborMarks NAS Deployment Instructions

This guide explains how to run HarborMarks on a NAS using Docker Compose.

## 1. Prerequisites

- A NAS with Docker support (for example Synology Container Manager, QNAP Container Station, or a Linux NAS with Docker Engine).
- SSH access to the NAS shell (recommended).
- Docker Compose available as `docker compose`.
- At least 2 GB RAM free for app + PostgreSQL.
- One free host port (default in this project: `3000`).

## 2. Copy Project To The NAS

Place the project on your NAS, for example:

```bash
/volume1/docker/harbormarks
```

Then open a shell in that directory:

```bash
cd /volume1/docker/harbormarks
```

## 3. Configure App Credentials In Compose

Edit `docker-compose.yml` and set at least these values under `services.app.environment`:

```yaml
HARBOR_BOOTSTRAP_ADMIN_EMAIL: admin@example.com
HARBOR_BOOTSTRAP_ADMIN_NAME: Harbor Admin
HARBOR_BOOTSTRAP_ADMIN_PASSWORD: change_this_now
HARBOR_ALLOW_SIGNUP: "true"
HARBOR_CHECK_ORIGIN: "true"
```

Notes:

- In this repository, `docker-compose.yml` already sets the internal database URL to the `db` service.
- `HOST` and `PORT` are also forced by Compose for container runtime.
- Keep `HARBOR_CHECK_ORIGIN: "true"`. This is the CSRF origin check and turning it
  off on an internet-reachable deployment removes a real protection. It is read
  on every request, so changing it takes effect on restart without a rebuild.
- Behind a reverse proxy or tunnel the app sees the internal host it was
  forwarded to, such as `172.27.0.2:3000` or `192.168.1.50:7878`, while the
  browser sends `Origin: https://your-domain`. That mismatch is rejected with
  `Cross-site POST form submissions are forbidden`. Forwarding the `Host` header
  is not enough on its own, because the scheme still differs (`http` internally
  versus `https` publicly). Add your public hostname to `HARBOR_ALLOWED_DOMAINS`
  instead:

  ```yaml
  HARBOR_CHECK_ORIGIN: "true"
  HARBOR_ALLOWED_DOMAINS: harbormarks.example.com
  ```

  The value is a comma-separated list of hostnames, without scheme or port.
- Do not add `SESSION_SECRET`. The application has never read it. Sessions are
  opaque random tokens stored in the database.
- Bootstrap admin values are used only when the users table is empty.
- Always replace any example/default bootstrap credentials before starting in shared or production environments.
- You usually only need to set bootstrap admin values in `docker-compose.yml`.

## 3b. Configure Email (Digest, Password Reset, Verification)

Without this section, password reset and verification links are only logged in
the app container output (`docker compose logs app`), and the digest "Send
now" button reports that email is not configured. To activate real emails, set
these values under `services.app.environment` (see `.env.example` for the full
list):

```yaml
HARBOR_APP_BASE_URL: https://harbormarks.example.com
HARBOR_SMTP_HOST: mail.example.com
HARBOR_SMTP_PORT: "587"
HARBOR_SMTP_SECURE: "false"
HARBOR_SMTP_USER: harbormarks
HARBOR_SMTP_PASS: use_a_long_unique_password
HARBOR_SMTP_FROM: HarborMarks <marks@example.com>
```

Notes:

- `HARBOR_SMTP_HOST` + `HARBOR_SMTP_FROM` are the on/off switch. Everything
  else has working defaults for a standard STARTTLS submission server.
- Use `HARBOR_SMTP_SECURE: "true"` only for port 465 (implicit TLS).
  Port 587 uses `"false"` (STARTTLS upgrade).
- `HARBOR_APP_BASE_URL` must be your public address. Email links built from
  the internal container host (e.g. `http://172.27.0.2:3000`) are unreachable
  from an inbox; this override fixes that behind any reverse proxy.
- Any SMTP provider works (your NAS mail server, Gmail App Password, Mailgun,
  Postmark SMTP, etc.).
- Restart after changing these: `docker compose up -d` (they are read
  per send, but a restart guarantees a clean transporter).

### Gmail setup

Gmail works with these values:

```yaml
HARBOR_SMTP_HOST: smtp.gmail.com
HARBOR_SMTP_PORT: "587"
HARBOR_SMTP_SECURE: "false"
HARBOR_SMTP_USER: you@gmail.com
HARBOR_SMTP_PASS: xxxx-xxxx-xxxx-xxxx
HARBOR_SMTP_FROM: HarborMarks <you@gmail.com>
```

Two Gmail requirements:

1. **Use an App Password, not your normal password.** Google disabled plain
   password SMTP logins. Create one at Google Account → Security → 2-Step
   Verification (must be on) → App passwords, then paste the 16-character code
   (spaces optional) as `HARBOR_SMTP_PASS`.
2. **`HARBOR_SMTP_FROM` must be your Gmail address** (or a "Send mail as"
   alias verified in Gmail settings), otherwise Gmail rejects the send.

Step by step to get the App Password:

1. Go to https://myaccount.google.com/security and sign in.
2. Under "How you sign in to Google", click **2-Step Verification** and turn
   it on (phone number or authenticator app). This is required — without it
   Google hides the App Passwords option entirely.
3. Go to https://myaccount.google.com/apppasswords (or search "App passwords"
   in the account search bar).
4. Type a name like `HarborMarks` and click **Create**.
5. Copy the 16-character code from the yellow box. You only see it once — if
   you close the dialog, generate a new one.
6. Paste it as `HARBOR_SMTP_PASS` in `docker-compose.yml` (spaces are fine,
   they are ignored) and restart: `docker compose up -d`.
7. If you ever change your Google password, Google revokes all App Passwords
   — repeat steps 3–6 to make a fresh one. To remove access later, delete it
   at the same App Passwords page.

Note: App Passwords are unavailable on accounts that use only security keys
for 2-Step Verification, accounts under Advanced Protection, or Workspace
accounts where the admin disabled them.

Limits are generous for this use case: roughly 500 emails/day on free Gmail
(2,000 on Workspace), and the digest sends one email per opted-in user per
week. Test with Profile → Weekly digest → **Send now** after restarting.

Then each user opts in from **Profile → Weekly digest**:

1. Tick "Send me the weekly digest".
2. Pick the content: unread links from the last 7 days, all unread links, or
   all links saved in the last 7 days. Each item shows its title, description,
   your private note, tags, and saved date.
3. Save. Use **Send now** to test immediately (max 10 per hour).
4. Pick the weekday (Sunday by default) and hour (`07:00` by default, server
   timezone) for the automatic run. Users with nothing matching get no email
   that week. Changing the schedule later the same day does not re-trigger an
   automatic send that already went out.

About digest link tracking:

- Email links route through `GET /api/bookmarks/:id/open?sig=...`, which
  verifies an HMAC signature, mirrors the in-app open (unread → reading plus
  one visit), and 302-redirects to the saved page. Clicking works logged out
  on any device; archived bookmarks are never changed.
- The signing secret is generated automatically on the first digest send and
  stored in the `app_settings` table — no configuration needed, and signatures
  never expire. To invalidate all previously sent links (e.g. after forwarding
  an email somewhere it should not have gone), delete the row and restart:
  `DELETE FROM app_settings WHERE key = 'email_link_secret';` — a fresh secret
  is minted on the next send.
- Privacy: clicks are recorded only in your own database (read status + visit
  count). No third party sees them; the redirect target always comes from your
  stored bookmarks, never from link parameters.

Prefer your own scheduler (NAS task runner, Uptime Kuma, host cron)? Set:

```yaml
HARBOR_CRON_SECRET: use_a_long_random_secret
```

and trigger weekly with:

```bash
curl -X POST https://harbormarks.example.com/api/digest/run \
  -H "x-cron-secret: use_a_long_random_secret"
```

The endpoint is allowlisted without a session cookie and rate-limited; a wrong
or missing secret returns 401.

## 4. Build And Start

Run:

```bash
docker compose up -d --build
```

Check status:

```bash
docker compose ps
```

Follow logs:

```bash
docker compose logs -f app
```

## 5. Open In Browser

Use:

```text
http://<NAS_IP>:3000/login
```

Example:

```text
http://<your-nas-ip>:3000/login
```

If you use a reverse proxy, map your domain to `http://127.0.0.1:3000` on the NAS.

## 6. NAS Firewall And Router Notes

- Ensure NAS firewall allows inbound TCP `3000` from your LAN.
- Do not expose PostgreSQL (`5432`) to the internet.
- If remote internet access is needed, use a reverse proxy + HTTPS + authentication.

## 7. Common Troubleshooting

### App does not open

- Check containers:

```bash
docker compose ps
```

- Check app logs:

```bash
docker compose logs --tail=200 app
```

- Confirm NAS port use:

```bash
curl -I http://localhost:3000/login
```

### Login works but page errors

- Check database URL in running app:

```bash
docker compose exec -T app sh -lc 'echo "$DATABASE_URL"'
```

Expected host in URL is `db`, not `localhost`.

### Every page returns 500 after an upgrade

Symptom: `/login` renders, but every page after signing in returns 500. The app
log shows `Failed query: select ... from "bookmarks"` naming a column such as
`updated_at` or `deleted_at`.

Cause: the schema migrations did not run, so the code is newer than the database.

Check whether the migrator has ever run:

```bash
docker exec harbormarks-db psql -U astro -d harbormarks -c "select name from schema_migrations order by name"
```

`relation "schema_migrations" does not exist` means it never has. Take a dump
first (section 9), then run it by hand and restart:

```bash
docker exec harbormarks-app node ./scripts/migrate.mjs
docker restart harbormarks-app
```

If the database was hand-patched before the migrator was introduced, its schema
can be ahead of what `schema_migrations` records. Compare before running:

```bash
docker exec harbormarks-db psql -U astro -d harbormarks -c "\d bookmarks"
```

If `tags` is already `text[]` while `schema_migrations` is missing, record the
first two migrations as applied so the runner does not try to recreate a text
index on an array column:

```bash
docker exec harbormarks-db psql -U astro -d harbormarks -c "
CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT NOW());
INSERT INTO schema_migrations (name) VALUES ('0001_initial.sql'), ('0002_tags_array.sql') ON CONFLICT DO NOTHING;"
```

The permanent fix is to make sure the stack does not override the container
startup command. See section 11.

### Rebuild after code or env changes

```bash
docker compose up -d --build
```

### Stop and remove containers

```bash
docker compose down
```

To also remove database data volume:

```bash
docker compose down -v
```

Warning: `-v` deletes stored bookmarks.

## 8. Updating HarborMarks

**Take a database dump before upgrading.** See section 9 for the command.

From project directory:

```bash
git pull
docker compose up -d --build
```

Schema migrations run automatically when the app container starts, before the
server accepts requests, and are recorded in the `schema_migrations` table. If a
migration fails the container stops rather than starting against a half-migrated
database, so check the app logs if the container will not come up:

```bash
docker compose logs app | tail -50
```

### Older releases (pre-1.0)

Pre-1.0 upgrades (e.g. 0.9.4 search index, `tags` text-to-array conversion)
run automatically via the same startup migrator. See `CHANGELOG.md` for
per-release notes. If every page returns 500 after an upgrade, the migrator
did not run — see section 7.

## 9. Backup Recommendation

Because PostgreSQL data is in a Docker volume (`db_data`), set a NAS backup job for Docker volumes or do periodic SQL dumps.

Quick dump example:

```bash
docker compose exec -T db pg_dump -U astro harbormarks > harbormarks_backup.sql
```

Restore example:

```bash
cat harbormarks_backup.sql | docker compose exec -T db psql -U astro -d harbormarks
```

User-uploaded avatars live in the `uploads_data` volume (`/app/public/uploads`
in the container). Back it up alongside the database, or profile pictures are
lost on a fresh host:

```bash
docker run --rm -v harbormarks_uploads_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/harbormarks_uploads_backup.tar.gz -C /data .
```

Restore example:

```bash
docker run --rm -v harbormarks_uploads_data:/data -v "$PWD":/backup alpine \
  tar xzf /backup/harbormarks_uploads_backup.tar.gz -C /data
```

Use `docker volume ls` to confirm the exact volume name if your project
directory differs (Compose prefixes it, e.g. `harbormarks_uploads_data`).

## Recent Changes

See [CHANGELOG.md](./CHANGELOG.md) for full release notes. It is the single source of truth; the in-app changelog (`src/lib/changelog.ts`) is synced from it on every release.

Upgrade-relevant summary (see sections 8-9 for dump/restore):

- v1.2.2, v1.2.1: no schema migration (drop-in image swap).
- v1.2.0: one additive migration (`0011_api_keys.sql`).
- v1.1.2: no schema migration.
- v1.1.1: one additive migration (`0010_digest_schedule.sql`).
- v1.1.0: two additive migrations (`0008_digest_prefs.sql`, `0009_link_secret.sql`).
- v1.0.0: no schema migration.
- Pre-1.0: see CHANGELOG; startup migrator handles search index and tags conversion automatically.

## 10. Deploy Without Copying The Project To NAS

If you do not want to copy this repository to the NAS, publish a prebuilt image and deploy from a minimal Compose file.

This repository includes:

- `docker-compose.deploy.yml`: image-based deploy file (no local build).
- `.github/workflows/publish-ghcr.yml`: builds and pushes to GitHub Container Registry.

Current publish workflow in this repo: GHCR.

### A) Publish from GitHub Actions

GHCR workflow needs no extra secret in most repos because it uses `GITHUB_TOKEN`.

The publish workflow triggers on:

- push to `main`
- tags like `v1.0.0`
- manual run (`workflow_dispatch`)

### B) NAS-side files only

On NAS, create a small folder (for example `/volume1/docker/harbormarks`) with only:

- `docker-compose.deploy.yml`

Edit `docker-compose.deploy.yml` and set these values under `services.app.environment`:

```yaml
HARBOR_BOOTSTRAP_ADMIN_EMAIL: admin@example.com
HARBOR_BOOTSTRAP_ADMIN_NAME: Harbor Admin
HARBOR_BOOTSTRAP_ADMIN_PASSWORD: use_a_long_unique_password
HARBOR_ALLOW_SIGNUP: "false"
HARBOR_CHECK_ORIGIN: "true"
HARBOR_ALLOWED_DOMAINS: harbormarks.example.com
```

The `app` service must also keep the `command:`, `healthcheck:`, and
`depends_on: db: condition: service_healthy` entries from
`docker-compose.deploy.yml`. If you are pasting a stack into Portainer rather than
using the file, paste all of it — see section 11.

In `docker-compose.deploy.yml`, set your image reference (default shown here is GHCR):

- GHCR: `ghcr.io/aperezm85/harbormarks:latest`

Start/update on NAS:

```bash
docker compose -f docker-compose.deploy.yml pull
docker compose -f docker-compose.deploy.yml up -d
```

### C) Recommended tag strategy

For safer upgrades on NAS, pin to a version tag (for example `:v1.2.0`) instead of always using `:latest`.

Rollback example:

1. Change image tag in `docker-compose.deploy.yml` to previous version.
2. Run `docker compose -f docker-compose.deploy.yml up -d`.

## 11. Deploying As A Portainer Stack

Portainer stacks are edited in the browser, so they drift from the files in this
repository. Two things matter most, and both have caused outages:

1. **The startup command must run the migrator.** The image's `CMD` is
   `sh -c "node ./scripts/migrate.mjs && node ./dist/server/entry.mjs"`. A stack
   that overrides `command:` or `entrypoint:`, or a container created from an
   older image definition, silently skips migrations. The app then starts against
   a schema that is older than the code and every authenticated page returns 500.
   State the command explicitly in the stack so it cannot be lost.
2. **The app must wait for the database.** `depends_on: - db` alone does not wait
   for Postgres to accept connections, so on a cold start the migrator can fail
   with connection-refused before the database is up.

Paste this as the stack definition, replacing the bootstrap password and the
published port:

```yaml
services:
  db:
    image: postgres:17
    container_name: harbormarks-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: astro
      POSTGRES_PASSWORD: astro
      POSTGRES_DB: harbormarks
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U astro -d harbormarks"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s

  app:
    image: ghcr.io/aperezm85/harbormarks:latest
    container_name: harbormarks-app
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://astro:astro@db:5432/harbormarks
      # Used only for first-start bootstrap when the users table is empty.
      HARBOR_BOOTSTRAP_ADMIN_EMAIL: admin@example.com
      HARBOR_BOOTSTRAP_ADMIN_NAME: Harbor Admin
      HARBOR_BOOTSTRAP_ADMIN_PASSWORD: use_a_long_unique_password
      HARBOR_ALLOW_SIGNUP: "false"
      HARBOR_CHECK_ORIGIN: "true"
      # Your public hostname, required behind a reverse proxy or tunnel.
      HARBOR_ALLOWED_DOMAINS: harbormarks.example.com
      HOST: 0.0.0.0
      PORT: 3000
    command: ["sh", "-c", "node ./scripts/migrate.mjs && node ./dist/server/entry.mjs"]
    volumes:
      # Persist user-uploaded avatars across image updates.
      - uploads_data:/app/public/uploads
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/healthz >/dev/null 2>&1 || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
    ports:
      - "7878:3000"
    depends_on:
      db:
        condition: service_healthy

volumes:
  db_data:
  uploads_data:
```

Notes:

- **Do not add `SESSION_SECRET`.** The application has never read it.
- **Do not set `HARBOR_CHECK_ORIGIN: "false"`.** Set `HARBOR_ALLOWED_DOMAINS` to
  your public hostname instead. See section 3.
- After updating the stack, use Portainer's **Update the stack** with
  *Re-pull image* enabled, so the container is recreated rather than restarted.
  A restarted container keeps its old definition, including a missing `command:`.
- Confirm migrations ran by checking the app log for `Applied migration ...`
  lines, or that `schema_migrations` is populated.

## 12. Save From iPhone / iPad (Shortcuts) And Desktop (Bookmarklet)

The quick-save page accepts shared links with no API key setup:

```text
https://YOUR-HOST/save?url=<encoded-url>&title=<encoded-title>&tags=<a,b>&note=<text>
```

Only `url` is required. An empty title triggers a server-side metadata
fetch; tags are comma-separated (max 8); duplicates show the existing
bookmark instead of an error. Log in once in Safari — later saves reuse
that session, and a logged-out visit returns to `/save` after login.

### iOS Shortcut (Share Sheet → Save to HarborMarks)

1. Shortcuts app → `+` → name it `Save to HarborMarks`.
2. Add `Receive [URLs, Safari web pages] input from [Share Sheet]`
   (enable `Show in Share Sheet`).
3. Add `Get Details of Safari Web Page` → `Page URL` → new variable
   `PageURL`. Add again → `Page Title` → `PageTitle`.
4. Add `URL Encode` on `PageURL` → `EncURL`; add `URL Encode` on
   `PageTitle` → `EncTitle`.
5. Add `Text`: `https://YOUR-HOST/save?url=EncURL&title=EncTitle`
   (use the `Select Variable` tokens for `EncURL`/`EncTitle`).
6. Add `Open URLs` with that text.

Usage: Safari → Share → Save to HarborMarks → tap Save. Replace
`YOUR-HOST` with your public address (same value as
`HARBOR_APP_BASE_URL`).

### Background Shortcut (API key, no Safari open)

Needs an API key from Profile → API keys (see the API key rollout in
the changelog). Use `Get Contents of URL`:

- URL: `https://YOUR-HOST/api/bookmarks`, method `POST`.
- Headers: `Authorization: Bearer <key>`, `Content-Type: application/json`.
- Body (JSON): `{"url": "PageURL", "title": "PageTitle", "status": "unread"}`.
- A `409` response with `code: "duplicate_bookmark"` means the link is
  already saved; show its `existing.title` in a notification.

### Desktop bookmarklet

Create a bookmark with this URL (replace `YOUR-HOST`):

```js
javascript:(function(){location.href='https://YOUR-HOST/save?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)})()
```

Click it on any page to open the quick-save form with the title prefilled.

### Desktop browser extension (Chrome / Edge)

For a toolbar button instead of a bookmarklet, load the MV3 extension in
`extension/` unpacked — full setup (API key, `HARBOR_CORS_ORIGINS`, test
button) is in `extension/README.md`. You get a popup save form plus a
right-click "Save to HarborMarks" entry that uses the `/save` page above,
so the menu works even before an API key is configured.

## 13. Migrate From Pocket / Raindrop / Browsers

Import lives at **Dashboard → Import bookmarks** (`POST /api/bookmarks/import`).
It accepts **HarborMarks JSON**, **Netscape HTML**, **Pocket CSV**, and **generic
CSV with a `url` column**, auto-detected from content + filename (override with
the Format picker). The 10 MB cap is enforced both by `content-length` and by
file size — over-limit uploads return `413 "File exceeds the 10 MB import limit."`.
Import does no metadata fetch; saved rows keep their source title/tags and fall
back to the URL when the title is missing.

Shared import behavior (all sources):

- **Duplicate strategies** (Duplicates picker, default `skip`):
  `skip` leaves the existing bookmark untouched, `merge-tags` unions only the
  new tags into the existing row, `create-anyway` inserts a true duplicate.
- **`createdAt` preservation**: Pocket `time_added` (Unix seconds), Netscape
  `ADD_DATE` (Unix seconds), generic `created_at` (ISO), and HarborMarks JSON
  `createdAt` (ISO) are stored as the bookmark's creation date. Anything
  unparseable falls back to "now".
- **Idempotency check**: re-importing the same file with `skip` imports zero
  the second time (`skippedDuplicates` goes up, `imported` stays 0). Use the
  summary line in the dialog to confirm (`Imported N, skipped M duplicate(s)`).
- **Failures**: rows without a usable `url` are reported as failures
  (`Line N: reason`, first 20 shown), never silently dropped.

### Pocket CSV → Import

1. In Pocket, export to CSV (`title,url,time_added,tags,status` header).
2. In HarborMarks: Import dialog → Format `Auto-detect` (or `CSV`), Duplicates
   `skip`, pick the file → Import.
3. Expected on a fresh account: `imported` equals the data rows in the CSV;
   archived Pocket rows import as normal bookmarks (archive state is not
   preserved). Bracketed tag cells (`["news", "pocket"]`, `[news;rust]`) become
   plain tags.
4. Re-import the same file with `skip` → `imported 0`.

### Raindrop → Import (HTML, recommended)

1. In Raindrop, export to HTML (Netscape format).
2. In HarborMarks: Import dialog → Format `Auto-detect` (or `Netscape HTML`),
   Duplicates `skip` → Import.
3. Expected: one bookmark per `<A HREF>`, folder headings become tags
   (`Dev > Rust` yields both tags), `ADD_DATE` becomes `createdAt`.
4. Note on Raindrop CSV: a generic CSV with a lowercase `url` column imports
   through the same CSV path on a best-effort basis (unknown Raindrop-only
   columns are ignored). Prefer the HTML export for fidelity — no Raindrop-only
   parser ships.

### Chrome / Firefox HTML export → Import

1. Chrome: Bookmarks Manager → ⋮ → Export bookmarks (HTML). Firefox: Library →
   Bookmarks → Manage → Import and Backup → Export to HTML.
2. In HarborMarks: Import dialog → Format `Auto-detect` (or `Netscape HTML`),
   Duplicates `skip` → Import.
3. Expected: same as Raindrop — anchors become bookmarks, folders become tags,
   descriptions come from following `<DD>` text.

### HarborMarks JSON round-trip

1. Export from HarborMarks (JSON `{"version": 1, "bookmarks": [...]}`).
2. On a fresh account: Import dialog → Format `HarborMarks JSON` → Import.
3. Expected: lossless for `url/title/description/favicon/previewImage/tags/
   isFavorite/createdAt`; `visitCount/updatedAt/lastVisitedAt` are not carried.
   Re-import with `skip` → `imported 0`.

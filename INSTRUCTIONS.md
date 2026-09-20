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
- Restart after changing these: `docker compose up -d --build` (they are read
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
   they are ignored) and restart: `docker compose up -d --build`.
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

### Upgrading to 0.9.4

This release adds a generated search column and a GIN index to the `bookmarks`
table. Adding a stored generated column rewrites the table under a brief
exclusive lock, so the startup migration can take a moment on a large
collection. Nothing else is required.

If your database was created before migrations existed, this upgrade also
converts `tags` from a text column to a text array. Existing tags are preserved.

> If you built an image between 30 and 31 August 2026, that build shipped a
> version of `0002_tags_array.sql` that dropped the `tags` column instead of
> converting it. Restore from a dump if your tags disappeared.

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

### 2026-09-20 (v1.1.1)

- Per-user digest schedule: each user picks a weekday (Sunday by default) and
  an hour (`07:00` by default) on the profile page; the scheduler ticks every
  minute with a once-per-day guard plus a startup catch-up run. "Send now"
  never blocks the automatic send. Times use the server timezone (`TZ` is
  pinned to UTC in the image and both Compose files — override it for local
  time).
- One additive migration ships in this release
  (`0010_digest_schedule.sql`, `send_day`/`send_time` on
  `digest_preferences`). Take a dump before upgrading as usual (section 9);
  migrations run automatically at container start.
- Security dependencies: `pnpm audit` is clean (was 9 findings) via `astro`
  7.3.3, `shadcn` 4.21.0, and bumped workspace overrides; `clsx` +
  `tailwind-merge` were replaced with the drop-in `cn` package.
- Profile page: Account details card removed, single-column order (picture,
  profile, password, digest). Profile and admin Users pages share a
  dashboard-style header.
- Bumped `package.json` to 1.1.1 and synced the README, INSTRUCTIONS, and
  in-app changelog (`src/lib/changelog.ts`).

### 2026-09-13 (v1.1.0)

- Weekly digest email (opt-in per user on the profile page): unread links from
  the last 7 days, all unread, or everything saved in the last 7 days, sent
  Sunday morning plus an on-demand "Send now" action. See section 3b for SMTP
  setup and activation.
- Real password reset and email verification delivery over SMTP; without SMTP
  the links keep falling back to the server log.
- One additive migration ships in this release (`0008_digest_prefs.sql`,
  digest preferences defaulting to off) plus `0009_link_secret.sql`
  (`app_settings` for email link signing). Take a dump before upgrading as usual
  (section 9); migrations run automatically at container start.
- Bumped `package.json` to 1.1.0 and synced the README, INSTRUCTIONS, and
  in-app changelog (`src/lib/changelog.ts`).

### 2026-09-06 (v1.0.0)

- Duplicate resolution: `POST /api/bookmarks` returns a structured 409
  (`code: "duplicate_bookmark"` with the existing row) instead of a bare
  error; `resolve: "merge-tags"` unions tags into the existing bookmark,
  `"create-anyway"` inserts a true duplicate. `CreateBookmarkDialog.tsx`
  surfaces all three options (open existing / merge / save anyway).
- Tag management: `renameBookmarkTag`, `mergeBookmarkTags`, and
  `deleteBookmarkTag` in `src/lib/bookmarks.ts` (per-user, trash-excluded,
  case-insensitive), a new `POST /api/bookmarks/tags/manage` route, and a
  `/tags` page (`TagManager.tsx` behind a single `client:only` `TagsPage`
  island) linked from the sidebar.
- Liveness probe: `GET /api/healthz` (unauthenticated, no DB touch,
  allowlisted in `src/middleware.ts`); both Compose files and the Portainer
  stack probe it instead of `/login`.
- Uploads persistence: `uploads_data:/app/public/uploads` volume in both
  Compose files plus `mkdir -p` in the runtime image; section 9 documents
  backup/restore of the volume.
- Deploy defaults: `docker-compose.deploy.yml` ships
  `HARBOR_ALLOW_SIGNUP: "false"` with a non-default bootstrap password
  placeholder.
- Release hygiene: `.github/workflows/ci.yml` runs lint + typecheck + test
  on pull requests; `CHANGELOG.md` is the single source of truth (README
  links to it); new `SECURITY.md` and issue templates.
- Bumped `package.json` to 1.0.0 and synced the in-app changelog
  (`src/lib/changelog.ts`), `CHANGELOG.md`, and INSTRUCTIONS.
- No new schema migration ships in this release, so upgrading is a drop-in
  image swap with no restart-time table rewrite.

### 2026-09-06 (v0.9.11)

- Click-to-read: `HarborCard.tsx` `openBookmark` promotes `unread` to `reading`
  once the `/visit` POST succeeds (optimistic `onSaved` with status rollback
  only; archived and trash items untouched). Failures surface via toast with
  the visit counter restored.
- Save/Edit dialog redesign (`CreateBookmarkDialog.tsx`, proto-styled): preview
  image header, a favorites switch persisted inline through a new optional
  `isFavorite` passthrough (`updateBookmarkById`, both JSON routes), and delete
  moved inside the dialog.
- `N` shortcut (`app-sidebar.tsx`): opens the save-a-link dialog via the
  trigger ref, dashboard-scoped, ignoring modified keys, typing targets, and
  open dialogs/menus/command palettes.
- Freedium metadata unwrap: new `src/lib/freedium-url.ts` (`unwrapFreediumUrl`,
  unit-tested in `freedium-url.test.ts`) extracts the inner article URL from
  mirror paths; `metadata.ts` `fetchPageMetadata` sources metadata from the
  inner URL with a single mirror retry when the inner fetch yields only the
  fallback. Saved bookmark URLs are untouched.
- Avatar upload: new `src/lib/avatar-storage.ts`, `POST
  /api/auth/profile-avatar`, serving routes (`/api/avatar/[file]`,
  `/uploads/avatars/[file]`), `updateProfileAvatar` plus strict
  `isAllowedAvatarUrl` in `src/lib/auth.ts`, profile page UI with
  `ProfileToast.tsx` (floating toasts instead of layout-shifting ones), and a
  `public/uploads/` gitignore rule so uploaded files stay local.
- Bumped `package.json` to 0.9.11 and synced the README, INSTRUCTIONS, and
  in-app changelog (`src/lib/changelog.ts`).

### 2026-09-06 (v0.9.10)

- Story 12 notes slice: migration `0006_bookmark_note.sql` adds a nullable `note`
  column and rebuilds the `search_vector` generated column against a new 5-argument
  `harbormarks_bookmark_search_text()` so note text is indexed (drop index, drop
  column, drop the old 4-arg function, recreate, reindex — all in the one file, so
  new notes are searchable instead of silently unindexed). `note` flows through
  `src/db/schema.ts`, `BookmarkCardData`, `create/updateBookmarkById`, and both
  JSON routes (form path untouched); `CreateBookmarkDialog.tsx` gains a "Your
  note" field that metadata refetch never clobbers; `HarborCard.tsx` renders the
  note inline on grid/list and behind a note-icon dialog on compact.
- Read status slice: migration `0007_bookmark_status.sql` adds `status TEXT NOT
  NULL DEFAULT 'unread'` with a `chk_bookmarks_status` check constraint (guarded
  by a `DO` block for idempotence). Wired through `listBookmarks` (new `unread`
  view), the `is:unread` / `is:reading` / `is:archived` operators (no longer
  no-ops), `countBookmarksByView`, a new `POST /api/bookmarks/[id]/status` route,
  a cycle control plus badge on the card, and an Unread chip in
  `DashboardSubBar.tsx`. Existing rows default to `unread`.
- Bumped `package.json` to 0.9.10 and synced the README, INSTRUCTIONS, and
  in-app changelog (`src/lib/changelog.ts`).

### 2026-09-06 (v0.9.9)

- Added a card view selector (`src/components/dashboard/CardViewSelector.tsx`,
  a segmented control next to the theme toggle) with three densities: `grid`
  (the current card), `list` (horizontal cards with a 120–152px thumbnail), and
  `compact` (single 44px rows that render no preview `<img>` at all).
- The choice persists in `localStorage` (`harbormarks:card-view`, see the new
  `src/lib/card-view.ts`); `DashboardLayout.tsx` owns the state, hydrates it in
  an effect to avoid an SSR mismatch, and gates the container with `invisible`
  until applied so reloads never flash the wrong layout. `HarborCard.tsx` takes
  a `viewMode` prop with early returns for `list`/`compact`, reusing the same
  visit/favorite/delete/restore handlers. Conditional classes go through `cn()`,
  never string concatenation — `prettier-plugin-tailwindcss` eats leading spaces
  inside `className` template literals (verified at the byte level).
- No new schema migration ships in this release, so upgrading is a drop-in
  image swap with no restart-time table rewrite.

### 2026-09-05 (v0.9.8)

- Redesigned the bookmark card (`src/components/ui/HarborCard.tsx`) into a more
  compact layout: the URL and a relative timestamp in the header, the description
  and tags in the body, and the visit count plus the favorite/edit/delete actions
  in a footer. Relative timestamps use the Temporal date API
  (`@js-temporal/polyfill`) with `Intl.RelativeTimeFormat`.
- Preview images render at full brightness (the previous dimmed/grayscale
  treatment is gone), and card action buttons use a smaller `icon-xs` size.
- The AI-summarize and visit-count-reset actions are temporarily disabled (commented
  out) while the card is redesigned; they are not removed.
- No new schema migration ships in this release, so upgrading is a drop-in
  image swap with no restart-time table rewrite.

### 2026-09-03 (v0.9.7)

- Search now parses the `q` parameter into operators (`tag:`, `site:`, `is:`,
  `has:`, `before:`, `after:`) plus free text in a new pure module
  (`src/lib/bookmark-query.ts`); `listBookmarks` builds the SQL from the
  structured result with parameter binding, so operators and free text combine
  and stay scoped to the requesting user.
- `is:unread` is accepted but ignored in SQL until a read-status column lands
  (story 12); unknown operators and malformed dates degrade to free text.
- No new schema migration ships in this release, so upgrading is a drop-in
  image swap with no restart-time table rewrite.
- Brought the README, changelog, and package version back in sync for the release.

### 2026-09-03 (v0.9.6)

- Added five nullable enrichment columns (`site_name`, `author`, `published_at`,
  `language`, `canonical_url`) via migration `0005_bookmark_enrichment.sql`, applied
  automatically at container start. All are nullable, so the migration adds columns
  without rewriting existing rows; take a dump before any upgrade as usual.
- Metadata extraction now runs on `node-html-parser` and decodes the response body
  with the declared or detected charset, so non-UTF-8 pages no longer arrive as
  mojibake, and bot-protected pages fall back to a per-host adapter.
- Brought the README, changelog, and package version back in sync for the release.

### 2026-09-02 (v0.9.5)

- Added import, driven by a new `POST /api/bookmarks/import` route: JSON (this
  app's export format) and Netscape HTML, auto-detected from the file,
  authenticated per user, with duplicate URLs reconciled against existing data.
- Documented that no schema migration ships in 0.9.5: upgrading to this version
  runs no new migration, so it is a drop-in image swap with no restart-time table
  rewrite. Take a dump before any upgrade as usual.
- Fixed toasts rendering off-screen or unstyled by loading the Sonner stylesheet.
- Brought the README, changelog, and package version back in sync for the release.

### 2026-08-31 (v0.9.4)

- Documented that schema migrations run automatically at container start and are
  tracked in `schema_migrations`.
- Added an upgrade note for the 0.9.4 table rewrite and the tags conversion.
- Removed the stale `SESSION_SECRET` entry from the Compose environment block in
  section 3. The application has never read it; leave it out.
- Added section 11 with a known-good Portainer stack definition. Portainer stacks
  are edited in the browser and drift from this repository; a stack that loses the
  container startup command skips migrations and takes the app down after any
  release that adds a column.
- Added a troubleshooting entry for "every page returns 500 after an upgrade",
  which is what missing migrations look like from the outside.
- Added database healthchecks and `condition: service_healthy` to both Compose
  files, so the app no longer races Postgres on a cold start.
- Strengthened the guidance on `HARBOR_CHECK_ORIGIN`: fix the proxy's forwarded
  host rather than disabling the CSRF origin check.

### 2026-03-16

- Updated Compose setup docs to use bootstrap-admin env variables (`HARBOR_BOOTSTRAP_ADMIN_*`) instead of legacy login-only env keys.
- Clarified that bootstrap-admin values are used only when no users exist.
- Added explicit guidance to replace default/example credentials before deployment.
- Added GHCR-based image publishing and deploy-without-repo-copy workflow guidance.
- Added image-based deployment path using `docker-compose.deploy.yml`.

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

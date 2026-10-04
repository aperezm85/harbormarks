# HarborMarks

[![CI](https://github.com/aperezm85/harbormarks/actions/workflows/ci.yml/badge.svg)](https://github.com/aperezm85/harbormarks/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE.md)
[![Latest release](https://img.shields.io/github/v/release/aperezm85/harbormarks?sort=semver)](./CHANGELOG.md)
[![Node 22](https://img.shields.io/badge/node-22-green.svg)](./package.json)
[![pnpm 12](https://img.shields.io/badge/pnpm-12-orange.svg)](./package.json)

HarborMarks is a self-hosted bookmark manager built with Astro, React, PostgreSQL, and Drizzle.

It helps you save links, enrich them with metadata, organize them with tags, and quickly find what matters.

See [CHANGELOG.md](./CHANGELOG.md) for release notes (also shown in-app via the
sidebar "What's new" dialog, synced from `src/lib/changelog.ts`),
[ROADMAP.md](./ROADMAP.md) for planned work, and [CONTRIBUTING.md](./CONTRIBUTING.md)
to set up and submit a PR.

## What Is Implemented

- Authentication and account lifecycle:
  - login/logout with DB-backed session tokens,
  - self-service registration (when enabled),
  - forgot/reset password flows,
   - email verification request/confirm endpoints (real SMTP delivery when
     configured, server-log fallback otherwise),
  - route protection with role-based admin route guards.
- Account management:
  - redesigned profile page with dashboard-style layout,
  - profile update and password change flows,
  - quick back navigation from profile to main page.
- Admin user management page for creating users, assigning roles, and toggling account access.
- Sidebar account menu with profile, admin users (for admins), and logout actions.
- Bookmark CRUD (create, edit, delete).
- Per-user bookmark isolation across list, tags, favorites, updates, and visits.
- Soft delete with a Trash view: deleted bookmarks can be restored from the card
  or the undo toast, or deleted permanently from Trash.
- URL canonicalization on write (host, trailing slash, and tracking parameters)
  with duplicate detection per user on create and edit. Saving an existing URL
  returns the existing bookmark and offers open / merge-tags / save-anyway.
- Tag management screen (`/tags`, linked from the sidebar): rename a tag
  everywhere, merge one tag into another, or delete a tag from all bookmarks.
- Metadata extraction (title, description, favicon, preview image).
- Local proxying and caching for bookmark favicons and preview images to avoid hotlinking.
- Indexed PostgreSQL full-text search with relevance ranking.
- Paged bookmark lists with a "load more" control.
- Favorite bookmarks support with a dedicated Favorites page.
- Tag support with:
  - autocomplete in create/edit dialog,
  - sidebar tag list with counts,
  - sorting by count desc then name asc,
  - dedicated tag filter page (`/tag?tag=...`).
- Dashboard browse modes:
  - Recent,
  - Most visited (recency-weighted, so old counts decay),
  - Unorganized,
  - Trash.
- Visit tracking with reset action per bookmark.
- Preview image rendering in cards, with gradient fallback when unavailable.
- Persistent UI behavior:
  - client-side route transitions,
  - sidebar active state updates,
  - theme persistence (light, dark, and system).
- Operational and security baseline:
  - schema managed by versioned SQL migrations applied at startup,
  - origin checking on by default, with proxy-aware `Secure` cookies,
  - SSRF-guarded outbound fetches for metadata, summaries, and assets,
  - rate limiting on login, registration, and recovery endpoints,
  - automatic cleanup of expired sessions and tokens.
- Unauthenticated liveness probe at `GET /api/healthz` (no DB touch) for
  Docker healthchecks and reverse proxies.
- Weekly digest email (opt-in per user on the profile page): unread links from
  the last 7 days, all unread, or everything saved in the last 7 days, sent
  Sunday morning plus an on-demand "Send now" action. Clicking a digest link
  records it as reading (with a visit, like opening the card) via a signed
  redirect, then lands on the saved page — no login needed.
- Real password reset and email verification delivery over SMTP, with server-log
  fallback when SMTP is not configured.
- API keys for external clients (Profile → API keys, shown once, revokable):
  `POST /api/bookmarks` and the metadata read accept `Authorization: Bearer`,
  with per-key rate limits and session-only key management. Browser clients
  need their origin in `HARBOR_CORS_ORIGINS`; native clients need nothing.
- Quick-save page (`/save?url=…&title=…&tags=…&note=…`) for mobile share
  sheets, iOS Shortcuts, and bookmarklets: one-tap save, server title fetch
  on empty titles, already-saved card on duplicates, login return-to for
  logged-out visits. Setup in `INSTRUCTIONS.md` §12.
- Browser extension for Chrome/Edge (`extension/`, load unpacked, Manifest
  V3): popup save form with connection test plus right-click save via
  `/save`. Setup in `extension/README.md`.
- Copy-link button on every bookmark card (grid, list, compact, Trash) with
  a clipboard fallback for plain-HTTP origins.

## Tech Stack

- Astro + React
- Tailwind + shadcn/ui
- PostgreSQL
- Drizzle ORM
- Docker and Docker Compose

## Local Development

```bash
pnpm install
pnpm dev
```

Useful scripts:

```bash
pnpm dev
pnpm build
pnpm preview
pnpm lint
pnpm typecheck
```

## Environment Variables

This is the canonical env-var reference. `.env.example` mirrors it; `INSTRUCTIONS.md`
§3 shows the minimal Compose snippet and links here instead of duplicating values.

For Docker usage, set these directly under `services.app.environment` in `docker-compose.yml`
(or `docker-compose.deploy.yml` for image-based deploys).

Important: replace any committed example/default credentials before exposing the app on a network.

| Variable | Required / optional | Default | Restart vs rebuild | Where it is read |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Required | — (Compose: `postgresql://astro:astro@db:5432/harbormarks`) | Restart (`docker compose up -d`) | `src/db/client.ts` |
| `HARBOR_BOOTSTRAP_ADMIN_EMAIL` | Required on first start (when `users` is empty) | — | First start only | `src/lib/auth.ts` (`maybeBootstrapAdminUser`) |
| `HARBOR_BOOTSTRAP_ADMIN_PASSWORD` | Required on first start | — | First start only | `src/lib/auth.ts` |
| `HARBOR_BOOTSTRAP_ADMIN_NAME` | Optional | `""` (falls back to email prefix) | First start only | `src/lib/auth.ts` |
| `HARBOR_ALLOW_SIGNUP` | Optional | `"true"` when unset | Restart (read per request) | `src/lib/auth.ts` (`isSignupEnabled`) |
| `HARBOR_CHECK_ORIGIN` | Optional | `"true"` | Restart (read per request) | `src/lib/origin-check.ts` |
| `HARBOR_ALLOWED_DOMAINS` | Required behind a reverse proxy/tunnel; otherwise optional | `""` | Restart (read per request) | `src/lib/origin-check.ts` |
| `HOST` | Optional (Compose forces it) | `0.0.0.0` in Compose | Restart | Astro server runtime |
| `PORT` | Optional (Compose forces it) | `3000` in Compose | Restart | Astro server runtime |
| `HARBOR_APP_BASE_URL` | Optional, but required for correct email links | Incoming request host | Restart (read per send) | `src/lib/mailer.ts` (`resolveAppBaseUrl`) |
| `HARBOR_SMTP_HOST` | Optional (with `HARBOR_SMTP_FROM`: the mail on/off switch) | — | Restart | `src/lib/mailer.ts` |
| `HARBOR_SMTP_PORT` | Optional | `587` | Restart | `src/lib/mailer.ts` |
| `HARBOR_SMTP_SECURE` | Optional | `"false"` (`"true"` for port 465) | Restart | `src/lib/mailer.ts` |
| `HARBOR_SMTP_USER` | Optional | — | Restart | `src/lib/mailer.ts` |
| `HARBOR_SMTP_PASS` | Optional | — | Restart | `src/lib/mailer.ts` |
| `HARBOR_SMTP_FROM` | Optional (with `HARBOR_SMTP_HOST`: the mail on/off switch) | `HarborMarks <noreply@localhost>` | Restart | `src/lib/mailer.ts` |
| `HARBOR_CRON_SECRET` | Optional (only for external digest schedulers) | — | Restart | `src/pages/api/digest/run.ts` |
| `HARBOR_LINK_HEALTH_ENABLED` | Optional (broken link monitoring off unless set) | `"false"` | Restart | `src/lib/link-health-check.ts` (`getLinkHealthConfig`) |
| `HARBOR_LINK_HEALTH_HOUR` | Optional (UTC hour of the daily check) | `2` | Restart | `src/lib/link-health-check.ts` (`getLinkHealthConfig`) |
| `HARBOR_LINK_HEALTH_BATCH` | Optional (bookmarks checked per run) | `5` | Restart | `src/lib/link-health-check.ts` (`getLinkHealthConfig`) |
| `HARBOR_LINK_HEALTH_DELAY_MS` | Optional (pause between link checks) | `2000` | Restart | `src/lib/link-health-check.ts` (`getLinkHealthConfig`) |
| `HARBOR_CORS_ORIGINS` | Optional (only for browser-extension origins) | `""` | Restart | `src/lib/cors.ts` |
| `HARBOR_SECURE_COOKIES` | Optional | unset = auto (https via `x-forwarded-proto`) | Restart (read per request) | `src/lib/request-security.ts` |
| `TZ` | Optional | `UTC` | Restart | Node runtime / digest scheduler |
| `NODE_ENV` | Optional | `development` (`production` in image builds) | Restart (rebuild for prod bundle) | Astro / Node runtime |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Required for the `db` service only | `astro` / `astro` / `harbormarks` in Compose | Restart | Postgres container, not the app |

Notes:

- All app env vars are runtime-read. An env-only change needs a container
  recreate (`docker compose up -d`), never a rebuild. Add `--build` only when
  the code/image itself changed.
- Bootstrap admin variables are only used on first start when no users exist.
  Legacy `HARBOR_USER` / `HARBOR_PASSWORD` are still accepted as fallback
  bootstrap inputs but are deprecated — use `HARBOR_BOOTSTRAP_ADMIN_*`.
- If you start with `HARBOR_ALLOW_SIGNUP=false` and no bootstrap admin values,
  nobody can log in (no users + no self-registration). Set the bootstrap vars
  before first start on closed instances.
- For local non-Docker development, you can still use a `.env` file.

### Ports

- App: `3000:3000` (container serves `HOST:PORT` = `0.0.0.0:3000`).
- Database: `5432:5432` in `docker-compose.yml` (LAN/dev convenience only).
  `docker-compose.deploy.yml` does not publish it. Never expose `5432` to the internet.
- Behind a reverse proxy, map your domain to `http://127.0.0.1:3000` on the NAS
  and set `HARBOR_ALLOWED_DOMAINS` to your public hostname (see above).

### Backup

Back up both the Postgres volume (`db_data`) and the uploads volume
(`uploads_data`). Canonical dump/restore commands live in `INSTRUCTIONS.md` §9.

### Email delivery

Email delivery (weekly digest, password reset, email verification) needs SMTP
(see table above for defaults):

```bash
HARBOR_APP_BASE_URL=https://harbormarks.example.com
HARBOR_SMTP_HOST=mail.example.com
HARBOR_SMTP_PORT=587
HARBOR_SMTP_SECURE=false
HARBOR_SMTP_USER=harbormarks
HARBOR_SMTP_PASS=change_me
HARBOR_SMTP_FROM=HarborMarks <marks@example.com>
# Optional: shared secret so an external scheduler can trigger the digest
# via POST /api/digest/run instead of the built-in timer.
HARBOR_CRON_SECRET=use_a_long_random_secret
```

Without `HARBOR_SMTP_HOST`/`HARBOR_SMTP_FROM`, reset and verification links are
logged in the app container output instead of emailed, and the digest "Send
now" button reports that email is not configured. Templates follow the
emailcn.run registry blocks (newsletter block for the digest, auth link block
for reset/verify); see `components.json` (`@emailcn`) and
`src/lib/email-templates.ts`.

### Activating the weekly digest

1. Set the SMTP variables above (and `HARBOR_APP_BASE_URL` so links point at
   your public address), then restart (`docker compose up -d`).
2. Each user opts in from **Profile → Weekly digest**: tick "Send me the
   weekly digest", pick the content (unread from the last 7 days / all unread /
   everything saved in the last 7 days), Save. Each item shows its title,
   description, your private note, tags, and saved date; clicking a title
   marks it as reading and opens the article.
3. The digest goes out automatically on each user's chosen weekday and
   hour (Sunday 07:00 server time by default, one email per opted-in user,
   skipped when empty).
4. Use **Send now** on the same card to email the current selection
   immediately (limited to 10 per hour per user).
5. Prefer your own scheduler? Set `HARBOR_CRON_SECRET` and call
   `POST /api/digest/run` with the `x-cron-secret` header from host cron,
   Uptime Kuma, or a NAS task (weekly cadence recommended).

## Run With Docker Compose

Start app + database:

```bash
docker compose up --build
```

Detached mode:

```bash
docker compose up -d --build
```

Stop:

```bash
docker compose down
```

## Migrating from Pocket / Raindrop / browsers

Import ships (`POST /api/bookmarks/import`: HarborMarks JSON, Netscape HTML,
Pocket CSV, generic CSV with a `url` column, `skip` / `merge-tags` /
`create-anyway`, 10 MB cap). Step-by-step source guides live in
`INSTRUCTIONS.md` §13 — from the app, open the Import dialog and follow the
"Migration guide" link.

## Recent Changes

See [CHANGELOG.md](./CHANGELOG.md) for release notes. It is the single source
of truth; the in-app changelog (`src/lib/changelog.ts`) is synced from it on
every release.

## Upgrading

Migrations run automatically at container start (`node ./scripts/migrate.mjs`
before the server boots) and are tracked in the `schema_migrations` table.
If a migration fails the container stops instead of serving a half-migrated
database — check `docker compose logs app` in that case.

Generic upgrade:

```bash
# 1. Dump first (commands in INSTRUCTIONS.md §9).
docker compose exec -T db pg_dump -U astro harbormarks > harbormarks_backup.sql
# 2. Pull + rebuild + restart.
git pull
docker compose up -d --build
# 3. Confirm migrations applied.
docker compose logs app | tail -50
docker compose exec -T db psql -U astro -d harbormarks -c "select name from schema_migrations order by name"
```

Pin-to-tag strategy (recommended for NAS): set `image: ghcr.io/<owner>/harbormarks:vX.Y.Z`
instead of `:latest` in `docker-compose.deploy.yml`, so upgrades are deliberate.
To roll back, change the tag back to the previous version and run
`docker compose -f docker-compose.deploy.yml up -d`. See `INSTRUCTIONS.md`
§8, §10–§11 for Portainer stacks (keep the `command:` migrator entry) and
troubleshooting ("every page returns 500 after an upgrade" = migrations did not run).

## Support

- Found a bug? Open a [bug report](https://github.com/aperezm85/harbormarks/issues/new/choose)
  (include the HarborMarks version from the sidebar changelog or `package.json`,
  install method, and `docker compose logs --tail=100 app` with secrets trimmed).
- Have an idea? Open a [feature request](https://github.com/aperezm85/harbormarks/issues/new/choose)
  — check [ROADMAP.md](./ROADMAP.md) first to see if it is already planned.
- Found a security vulnerability? Open a private
  [GitHub Security Advisory](https://github.com/aperezm85/harbormarks/security/advisories/new)
  instead of a public issue (see [SECURITY.md](./SECURITY.md); expect an
  acknowledgement within 72 hours).
- Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).

HarborMarks is maintainer-run with no SLA: issues and PRs are handled on a
best-effort basis. Only the latest `v1.x` release line receives security fixes.

## Product Roadmap

See `ROADMAP.md` for planned features and delivery phases, and `IMPLEMENTATION.md`
for house rules, data-isolation conventions, and specs for the active stories
(most earlier stories there are marked done and kept as an archive).

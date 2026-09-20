# HarborMarks

HarborMarks is a self-hosted bookmark manager built with Astro, React, PostgreSQL, and Drizzle.

It helps you save links, enrich them with metadata, organize them with tags, and quickly find what matters.

## What Is Implemented

- Authentication and account lifecycle:
  - login/logout with DB-backed session tokens,
  - self-service registration (when enabled),
  - forgot/reset password flows,
  - email verification request/confirm endpoints (link output currently logged server-side),
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

For Docker usage, set these directly under `services.app.environment` in `docker-compose.yml`.

Important: replace any committed example/default credentials before exposing the app on a network.

Required:

```bash
DATABASE_URL=postgresql://astro:astro@db:5432/harbormarks
HARBOR_BOOTSTRAP_ADMIN_EMAIL=admin@example.com
HARBOR_BOOTSTRAP_ADMIN_NAME=Harbor Admin
HARBOR_BOOTSTRAP_ADMIN_PASSWORD=change_me
```

For local non-Docker development, you can still use a `.env` file.

Bootstrap notes:

- Bootstrap admin variables are only used on first start when no users exist.
- Legacy `HARBOR_USER` / `HARBOR_PASSWORD` are still accepted as fallback bootstrap inputs.

Optional / deployment-specific:

```bash
NODE_ENV=production
HARBOR_ALLOW_SIGNUP=true
HARBOR_CHECK_ORIGIN=true
HARBOR_ALLOWED_DOMAINS=harbormarks.example.com
```

Email delivery (weekly digest, password reset, email verification) needs SMTP:

```bash
HARBOR_APP_BASE_URL=https://harbormarks.example.com
HARBOR_SMTP_HOST=mail.example.com
HARBOR_SMTP_PORT=587
HARBOR_SMTP_SECURE=false
HARBOR_SMTP_USER=harbormarks
HARBOR_SMTP_PASS=change_me
HARBOR_SMTP_FROM=HarborMarks <marks@example.com>
# Optional: shared secret so an external scheduler can trigger the digest
# via POST /api/digest/run instead of the built-in Sunday-morning timer.
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
   your public address), then restart (`docker compose up -d --build`).
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

`HARBOR_CHECK_ORIGIN` controls the CSRF origin check on form submissions and is
read on every request, so changing it never requires a rebuild. Keep it `true`.

If you serve HarborMarks through a reverse proxy or tunnel, the app sees the
internal host it was forwarded to, not the public URL your browser used, and
rejects the mismatch with `Cross-site POST form submissions are forbidden`. List
your public hostname in `HARBOR_ALLOWED_DOMAINS` (comma-separated, hostname
only) instead of turning the check off.

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

## Recent Changes

See [CHANGELOG.md](./CHANGELOG.md) for release notes. It is the single source
of truth; the in-app changelog (`src/lib/changelog.ts`) is synced from it on
every release.

## Upgrading

Migrations run automatically at container start (`node ./scripts/migrate.mjs`
before the server boots) and are tracked in the `schema_migrations` table.

Before upgrading to 0.9.4, take a database dump. See the backup commands in
`INSTRUCTIONS.md`.

Two migrations in this release touch the `bookmarks` table:

- `0002_tags_array.sql` converts `tags` from scalar `TEXT` to `TEXT[]`. It now
  preserves existing values, parsing both the JSON-array and comma-separated
  forms. It is a no-op where `tags` is already `TEXT[]`.
- `0004_bookmark_search_vector.sql` adds a generated `search_vector` column and
  a GIN index. Adding a stored generated column rewrites the table and takes a
  brief exclusive lock, so expect the startup migration step to take a moment on
  a large collection.

If you ran a build between 30 and 31 August 2026, an earlier version of
`0002_tags_array.sql` dropped the `tags` column instead of converting it. That
version cannot restore the lost tags; restore from a dump if you hit it.

## Product Roadmap

See `ROADMAP.md` for planned features and delivery phases, and `IMPLEMENTATION.md`
for the detailed specifications of the work that is queued next.

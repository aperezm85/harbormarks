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
  with duplicate detection per user on create and edit.
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
```

Keep `HARBOR_CHECK_ORIGIN` enabled. If a reverse proxy causes origin mismatches, fix the forwarded host/proto headers instead of disabling the check globally.

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

### 2026-08-31 (v0.9.4)

- Added permanent delete from Trash, so a bookmark can be removed for good after
  a second, explicit confirmation.
- Moved search onto an indexed full-text column; it previously rebuilt the search
  index on every row of every query.
- Fixed the sidebar tag list returning a 500 on databases upgraded from an
  earlier release, where `tags` was still a scalar text column.
- Made the tags migration convert existing data instead of dropping the column.
  **Anyone upgrading from 0.9.2 or earlier should read the upgrade note below.**
- Fixed favicons and preview images 404ing when the origin serves them with an
  empty or generic content type.
- Fixed four React state-in-effect bugs and cleared the remaining lint errors, so
  `pnpm lint`, `pnpm typecheck`, and `pnpm build` all pass.

### 2026-08-30

- Added local caching and proxying for bookmark favicons and preview images.
- Fixed sidebar tag navigation and dashboard route syncing on Astro client-side swaps.
- Brought the README, changelog, and package version back in sync for the release.

### 2026-03-16

- Migrated authentication to DB-backed users and session tokens.
- Added self-service registration, profile update, password change, forgot/reset password, and email verification request/confirm flows.
- Added admin user management (`/admin/users`) for creating users, assigning roles, and toggling active status.
- Scoped bookmark APIs and listing/tag queries to the authenticated user.
- Added sidebar user menu with account/admin navigation and logout.
- Redesigned the profile page to match the dashboard/admin visual pattern.
- Updated Docker env conventions to bootstrap-admin variables under Compose.
- Added GHCR publish workflow and image-based deploy compose file.

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

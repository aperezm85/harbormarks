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
- URL normalization on create and metadata fetch (`https://` is auto-added when missing).
- Metadata extraction (title, description, favicon, preview image).
- Favorite bookmarks support with a dedicated Favorites page.
- Tag support with:
  - autocomplete in create/edit dialog,
  - sidebar tag list with counts,
  - sorting by count desc then name asc,
  - dedicated tag filter page (`/tag?tag=...`).
- Dashboard browse modes:
  - Recent,
  - Most visited,
  - Unorganized.
- Visit tracking with reset action per bookmark.
- Preview image rendering in cards, with gradient fallback when unavailable.
- Persistent UI behavior:
  - client-side route transitions,
  - sidebar active state updates,
  - theme persistence (light, dark, and system).

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
SESSION_SECRET=change_me
```

For local non-Docker development, you can still use a `.env` file.

Bootstrap notes:

- Bootstrap admin variables are only used on first start when no users exist.
- Legacy `HARBOR_USER` / `HARBOR_PASSWORD` are still accepted as fallback bootstrap inputs.

Optional / deployment-specific:

```bash
NODE_ENV=production
HARBOR_ALLOW_SIGNUP=true
HARBOR_CHECK_ORIGIN=false
```

`HARBOR_CHECK_ORIGIN=false` helps when HarborMarks runs behind a reverse proxy or alternate external port (for example NAS UI port mapping) and login POST requests otherwise fail with `403 Forbidden`.

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

### 2026-03-16

- Migrated authentication to DB-backed users and session tokens.
- Added self-service registration, profile update, password change, forgot/reset password, and email verification request/confirm flows.
- Added admin user management (`/admin/users`) for creating users, assigning roles, and toggling active status.
- Scoped bookmark APIs and listing/tag queries to the authenticated user.
- Added sidebar user menu with account/admin navigation and logout.
- Redesigned the profile page to match the dashboard/admin visual pattern.
- Updated Docker env conventions to bootstrap-admin variables under Compose.
- Added GHCR publish workflow and image-based deploy compose file.

## Product Roadmap

See `ROADMAP.md` for planned features and delivery phases.

# HarborMarks

HarborMarks is a self-hosted bookmark manager built with Astro, React, PostgreSQL, and Drizzle.

It helps you save links, enrich them with metadata, organize them with tags, and quickly find what matters.

## What Is Implemented

- Authentication with login/logout and route protection.
- Bookmark CRUD (create, edit, delete).
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

Create a `.env` file in the project root.

Required:

```bash
DATABASE_URL=postgresql://astro:astro@db:5432/harbormarks
HARBOR_USER=admin
HARBOR_PASSWORD=change_me
```

Optional / deployment-specific:

```bash
SESSION_SECRET=change_me
NODE_ENV=production
```

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

## Product Roadmap

See `ROADMAP.md` for planned features and delivery phases.

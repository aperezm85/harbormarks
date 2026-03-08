# HarborMarks

HarborMarks is a self-hosted bookmark manager focused on searchability.

The goal is simple: save links, extract useful metadata, organize them with tags, and find them quickly with full-text search.

## Vision

- Save bookmarks in one place.
- Extract metadata from URLs (title, description, image, site info).
- Tag bookmarks for better organization.
- Allow to add favorite to the bookmark and allow a filter to see them.
- Search by text and tags from a fast search bar.
- Browse bookmarks by view mode when not searching:
  - Recent (newest first)
  - Most visited (highest click count first)
  - Unorganized (bookmarks without tags)
- Run everything locally with Docker for NAS/home server setups.

## Tech Stack

- Frontend: Astro + React + shadcn/ui
- Database: PostgreSQL
- ORM: Drizzle
- Deployment: Docker + Docker Compose (app + database)

## Core Data Model

Current implemented schema:

- `bookmarks`
  - `id` (serial primary key)
  - `url` (text, required)
  - `title` (text)
  - `description` (text)
  - `favicon` (text)
  - `is_favorite` (boolean, default `false`)
  - `visit_count` (integer, default `0`)
  - `tags` (text, stores serialized tags)
  - `created_at` (timestamp, default now)

Planned normalization:

- Move from serialized `tags` to relational tables (`tags`, `bookmark_tags`) for richer filtering and tag management.

## Features Roadmap

- [x] Add bookmark form (URL + optional notes)
- [x] Metadata extraction pipeline
- [x] Tag creation and tag assignment
- [x] Search bar for text queries
- [x] View tabs for non-search browsing (Recent, Most visited, Unorganized)
- [x] Bookmark click tracking (`visit_count`) for Most visited sorting
- [ ] Tag-based filtering
- [ ] Drizzle schema + migrations
- [ ] Dockerized app and PostgreSQL
- [ X ] Basic auth for private self-hosted usage

## Local Development

Install dependencies and run the app:

```bash
pnpm install
pnpm dev
```

Useful scripts:

```bash
pnpm dev        # start Astro dev server
pnpm build      # build production app
pnpm preview    # preview production build
pnpm lint       # lint project
pnpm typecheck  # run Astro type checks
```

## Environment Variables

Required variables:

```bash
DATABASE_URL=postgresql://astro:astro@db:5432/harbormarks
HARBOR_USER=admin
HARBOR_PASSWORD=change_me
NODE_ENV=production
```

## Docker Self-Hosting (Planned)

HarborMarks is intended to run with two containers:

- `app`: Astro application
- `db`: PostgreSQL database

Typical setup will use:

- `Dockerfile` for the app image
- `docker-compose.yml` to orchestrate app + database
- a persisted volume for PostgreSQL data

This makes deployment easy on NAS devices or any machine that can run Docker.

### Run Locally With Docker

1. Create a `.env` file in the project root with the required environment variables.
2. Start app + database:

```bash
docker compose up --build
```

Run detached if preferred:

```bash
docker compose up -d --build
```

Stop containers:

```bash
docker compose down
```

## Project Status

Current status:

- Basic auth is implemented (`/login`, middleware session cookie, logout route).
- PostgreSQL connection is wired with Drizzle.
- Bookmark listing and basic actions (toggle favorite, delete) are backed by the database.
- Search-driven bookmark filtering is available from the top search input.
- Non-search dashboard tabs are available:
  - `Recent`: sorts by `created_at` descending.
  - `Most visited`: sorts by `visit_count` descending.
  - `Unorganized`: shows bookmarks without tags.
- Opening a bookmark card increments its visit counter for future `Most visited` ranking.

Still in progress:

- Add-bookmark flow (button and form are not wired yet).
- Metadata extraction pipeline.
- Rich tagging model (`tags` and `bookmark_tags` tables) and full-text search.

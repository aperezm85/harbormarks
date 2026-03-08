# HarborMarks

HarborMarks is a self-hosted bookmark manager focused on searchability.

The goal is simple: save links, extract useful metadata, organize them with tags, and find them quickly with full-text search.

## Vision

- Save bookmarks in one place.
- Extract metadata from URLs (title, description, image, site info).
- Tag bookmarks for better organization.
- Allow to add favourite to the bookmark and allow a filter to see them.
- Search by text and tags from a fast search bar.
- Run everything locally with Docker for NAS/home server setups.

## Tech Stack

- Frontend: Astro + React + shadcn/ui
- Database: PostgreSQL
- ORM: Drizzle
- Deployment: Docker + Docker Compose (app + database)

## Core Data Model (Planned)

Main entities:

- `bookmarks`
  - `id`
  - `url`
  - `title`
  - `description`
  - `image_url`
  - `site_name`
  - `created_at`
  - `updated_at`
  - `is_favourite`
- `tags`
  - `id`
  - `name`
- `bookmark_tags`
  - `bookmark_id`
  - `tag_id`

This enables many-to-many tagging and flexible filtering/search.

## Features Roadmap

- [ ] Add bookmark form (URL + optional notes)
- [ ] Metadata extraction pipeline
- [ ] Tag creation and tag assignment
- [ ] Search bar for text queries
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

Still in progress:

- Add-bookmark flow (button and form are not wired yet).
- Metadata extraction pipeline.
- Rich tagging model (`tags` and `bookmark_tags` tables) and full-text search.
